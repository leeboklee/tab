import hashlib
import logging
import asyncio
import os
import random
import time
import subprocess
import sys
import tempfile
from collections import deque
from copy import deepcopy
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from cachetools import TTLCache

from services.audio_pipeline import AudioExtractionError, AudioPipelineService

_repo_root = Path(__file__).resolve().parents[1]
load_dotenv(_repo_root / ".env.local", override=False)
load_dotenv(_repo_root / ".env", override=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Guitar2Tabs Real Analysis API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3019", "http://localhost:5958", "http://localhost:3000", "http://127.0.0.1:3019"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = AudioPipelineService()

DIFFICULTY_BEGINNER = "\ucd08\uae09"
DIFFICULTY_INTERMEDIATE = "\uc911\uae09"
DIFFICULTY_ADVANCED = "\uace0\uae09"


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


ANALYSIS_RESULT_CACHE_TTL_SEC = _env_int("ANALYSIS_RESULT_CACHE_TTL_SEC", 3600)
ANALYSIS_RESULT_CACHE_MAXSIZE = _env_int("ANALYSIS_RESULT_CACHE_MAXSIZE", 256)
ANALYSIS_METRICS_LIMIT = _env_int("ANALYSIS_METRICS_LIMIT", 200)
ANALYSIS_INFLIGHT_LOCK_TTL_SEC = _env_int("ANALYSIS_INFLIGHT_LOCK_TTL_SEC", 3600)
ANALYSIS_INFLIGHT_LOCK_MAXSIZE = _env_int("ANALYSIS_INFLIGHT_LOCK_MAXSIZE", 512)
ANALYSIS_RESULT_CACHE = TTLCache(maxsize=ANALYSIS_RESULT_CACHE_MAXSIZE, ttl=ANALYSIS_RESULT_CACHE_TTL_SEC)
ANALYSIS_REQUEST_METRICS = deque(maxlen=ANALYSIS_METRICS_LIMIT)
ANALYSIS_INFLIGHT_LOCKS: Dict[str, asyncio.Lock] = {}
ANALYSIS_INFLIGHT_LOCK_LAST_USED: Dict[str, float] = {}


def _analysis_cache_key(namespace: str, ident: str, quality: str) -> str:
    source = f"{namespace}:{quality}:{ident.strip()}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()


def _analysis_cache_get(cache_key: str) -> Tuple[Optional[Dict[str, Any]], Optional[float]]:
    cached = ANALYSIS_RESULT_CACHE.get(cache_key)
    if not cached:
        return None, None
    payload = deepcopy(cached.get("payload", {}))
    return payload, cached.get("cached_at")


def _analysis_cache_set(cache_key: str, payload: Dict[str, Any]) -> None:
    ANALYSIS_RESULT_CACHE[cache_key] = {
        "payload": deepcopy(payload),
        "cached_at": time.time(),
    }


def _analysis_cache_set_meta(payload: Dict[str, Any], *, cache_hit: bool, cached_at: Optional[float] = None, **extra: Any) -> None:
    metadata = payload.setdefault("metadata", {})
    pipeline_diagnostics = metadata.setdefault("pipeline_diagnostics", {})
    cache_info = pipeline_diagnostics.setdefault("cache", {})
    cache_info["status"] = "hit" if cache_hit else "miss"
    if cache_hit and cached_at is not None:
        cache_info["cached_age_sec"] = round(max(time.time() - cached_at, 0.0), 3)
    for key, value in extra.items():
        if value is not None:
            cache_info[key] = value


def _record_analysis_metric(sample: Dict[str, Any]) -> None:
    ANALYSIS_REQUEST_METRICS.appendleft({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **sample,
    })


def _record_analysis_failure(
    *,
    cache_key: str,
    quality: str,
    request_source: str,
    error: str,
    failed_stage: str,
    total_sec: float,
) -> None:
    _record_analysis_metric(
        {
            "cache_key": cache_key,
            "cache_hit": False,
            "quality": quality,
            "request_source": request_source,
            "result_mode": "error",
            "total_sec": round(total_sec, 3),
            "extract_sec": None,
            "analysis_sec": 0.0,
            "error": error,
            "failed_stage": failed_stage,
        }
    )


def _failed_stage_for_exception(exc: Exception) -> str:
    if isinstance(exc, AudioExtractionError):
        return "youtube_extraction"
    if isinstance(exc, FileNotFoundError):
        return "audio_not_found"
    if isinstance(exc, RuntimeError):
        return "analysis_runtime"
    return "unknown"


def _prune_inflight_locks() -> None:
    now = time.time()
    stale_keys = [
        key
        for key, lock in ANALYSIS_INFLIGHT_LOCKS.items()
        if not lock.locked()
        and now - ANALYSIS_INFLIGHT_LOCK_LAST_USED.get(key, 0.0) > ANALYSIS_INFLIGHT_LOCK_TTL_SEC
    ]
    for key in stale_keys:
        ANALYSIS_INFLIGHT_LOCKS.pop(key, None)
        ANALYSIS_INFLIGHT_LOCK_LAST_USED.pop(key, None)

    if len(ANALYSIS_INFLIGHT_LOCKS) <= ANALYSIS_INFLIGHT_LOCK_MAXSIZE:
        return

    overflow_keys = sorted(
        (
            key
            for key, lock in ANALYSIS_INFLIGHT_LOCKS.items()
            if not lock.locked()
        ),
        key=lambda key: ANALYSIS_INFLIGHT_LOCK_LAST_USED.get(key, 0.0),
    )
    for key in overflow_keys[: max(len(ANALYSIS_INFLIGHT_LOCKS) - ANALYSIS_INFLIGHT_LOCK_MAXSIZE, 0)]:
        ANALYSIS_INFLIGHT_LOCKS.pop(key, None)
        ANALYSIS_INFLIGHT_LOCK_LAST_USED.pop(key, None)


def _get_inflight_lock(cache_key: str) -> asyncio.Lock:
    lock = ANALYSIS_INFLIGHT_LOCKS.get(cache_key)
    if lock is None:
        lock = asyncio.Lock()
        ANALYSIS_INFLIGHT_LOCKS[cache_key] = lock
    ANALYSIS_INFLIGHT_LOCK_LAST_USED[cache_key] = time.time()
    _prune_inflight_locks()
    return lock


class AnalysisRequest(BaseModel):
    url: str = Field(..., description="YouTube URL")
    quality: str = Field("balanced", description="Analysis quality: balanced, local_quality, cloud")


class AnalyzeFromAudioRequest(BaseModel):
    audio_id: str = Field(..., description="Saved audio identifier")
    quality: str = Field("balanced", description="Analysis quality: balanced, local_quality")


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def _coerce_api_response(body: Any) -> ApiResponse:
    if isinstance(body, ApiResponse):
        return body
    if isinstance(body, dict):
        if "success" in body:
            return ApiResponse(
                success=bool(body.get("success")),
                data=body.get("data"),
                error=body.get("error"),
            )
        return ApiResponse(success=True, data=body)
    return ApiResponse(success=False, error="Invalid cloud analysis response", data={"failed_stage": "cloud_analysis"})


def _analysis_error_response(
    error: str,
    *,
    failed_stage: str,
    data: Optional[Dict[str, Any]] = None,
) -> ApiResponse:
    payload: Dict[str, Any] = {"failed_stage": failed_stage}
    if data:
        payload.update(data)
    return ApiResponse(success=False, error=error, data=payload)


def _analysis_dependency_status() -> Dict[str, Any]:
    status = {"librosa": False, "numpy": False}
    try:
        import librosa  # noqa: F401

        status["librosa"] = True
    except Exception:
        pass

    try:
        import numpy  # noqa: F401

        status["numpy"] = True
    except Exception:
        pass

    return status


def _cloud_analysis_status() -> Dict[str, Any]:
    return {
        "configured": bool(os.getenv("CLOUD_ANALYSIS_API_BASE", "").strip()),
        "quality_endpoint": os.getenv("CLOUD_ANALYSIS_API_BASE", "").strip(),
        "api_key_configured": bool(os.getenv("CLOUD_ANALYSIS_API_KEY", "").strip()),
    }


def _high_quality_status() -> Dict[str, Any]:
    try:
        import demucs  # noqa: F401
        import torch

        return {
            "demucs_available": True,
            "torch_available": True,
            "cuda_available": bool(torch.cuda.is_available()),
            "device": os.getenv("DEMUCS_DEVICE", "cuda" if torch.cuda.is_available() else "cpu"),
            "model": os.getenv("DEMUCS_MODEL", "htdemucs_6s"),
        }
    except Exception as exc:
        return {
            "demucs_available": False,
            "torch_available": False,
            "cuda_available": False,
            "device": "unavailable",
            "model": os.getenv("DEMUCS_MODEL", "htdemucs_6s"),
            "error": str(exc),
        }


def _forward_to_cloud_analysis(request: AnalysisRequest) -> Optional[ApiResponse]:
    base_url = os.getenv("CLOUD_ANALYSIS_API_BASE", "").strip().rstrip("/")
    if not base_url:
        return None

    headers = {"Content-Type": "application/json"}
    api_key = os.getenv("CLOUD_ANALYSIS_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    timeout = int(os.getenv("CLOUD_ANALYSIS_TIMEOUT_SEC", "900"))
    payload = {"url": request.url, "quality": "local_quality"}
    try:
        response = requests.post(f"{base_url}/analyze", json=payload, headers=headers, timeout=timeout)
        response.raise_for_status()
        return _coerce_api_response(response.json())
    except requests.Timeout as exc:
        logger.error("Cloud analysis timed out: %s", exc)
        return _analysis_error_response(
            "Cloud analysis timed out",
            failed_stage="cloud_analysis_timeout",
            data={"cloud_configured": True},
        )
    except requests.RequestException as exc:
        logger.error("Cloud analysis request failed: %s", exc)
        return _analysis_error_response(
            f"Cloud analysis failed: {exc}",
            failed_stage="cloud_analysis",
            data={"cloud_configured": True},
        )
    except ValueError as exc:
        logger.error("Cloud analysis returned invalid JSON: %s", exc)
        return _analysis_error_response(
            "Cloud analysis returned invalid JSON",
            failed_stage="cloud_analysis",
            data={"cloud_configured": True},
        )


def _normalize_tempo(raw_tempo: Any) -> int:
    try:
        if hasattr(raw_tempo, "item"):
            raw_tempo = raw_tempo.item()
        tempo = int(round(float(raw_tempo)))
    except Exception:
        tempo = 120
    return max(60, min(220, tempo))


def _estimate_key(chroma_mean: Any) -> str:
    try:
        import numpy as np

        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=float)
        scores = []
        for shift in range(12):
            shifted = np.roll(profile, shift)
            score = float(np.dot(chroma_mean, shifted))
            scores.append(score)
        return note_names[int(np.argmax(scores))]
    except Exception:
        return "C"


def _estimate_chords(chroma: Any, sr: int, hop_length: int) -> List[Dict[str, Any]]:
    try:
        import numpy as np

        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        templates = {}
        for root_idx, root_name in enumerate(note_names):
            major = np.zeros(12, dtype=float)
            minor = np.zeros(12, dtype=float)
            for interval in (0, 4, 7):
                major[(root_idx + interval) % 12] = 1.0
            for interval in (0, 3, 7):
                minor[(root_idx + interval) % 12] = 1.0
            templates[root_name] = major
            templates[f"{root_name}m"] = minor

        segment_frames = 96
        max_segments = 12
        result: List[Dict[str, Any]] = []
        total_frames = chroma.shape[1]

        for idx, frame_start in enumerate(range(0, total_frames, segment_frames)):
            if idx >= max_segments:
                break
            frame_end = min(total_frames, frame_start + segment_frames)
            segment = np.mean(chroma[:, frame_start:frame_end], axis=1)
            best_chord = "C"
            best_score = -1.0
            for chord, template in templates.items():
                template_norm = template / max(float(np.linalg.norm(template)), 1e-9)
                segment_norm = segment / max(float(np.linalg.norm(segment)), 1e-9)
                score = float(np.dot(segment_norm, template_norm))
                if score > best_score:
                    best_score = score
                    best_chord = chord
            start_time = (frame_start * hop_length) / sr
            duration = ((frame_end - frame_start) * hop_length) / sr
            result.append(
                {
                    "chord": best_chord,
                    "start_time": round(start_time, 2),
                    "duration": round(duration, 2),
                    "confidence": round(max(0.2, min(0.99, best_score)), 3),
                }
            )

        return result
    except Exception:
        return []


def _estimate_difficulty(tempo: int, onset_density: float, avg_centroid: float) -> str:
    score = 0
    if tempo >= 150:
        score += 1
    if onset_density >= 2.8:
        score += 1
    if avg_centroid >= 2500:
        score += 1

    if score <= 1:
        return DIFFICULTY_BEGINNER
    if score == 2:
        return DIFFICULTY_INTERMEDIATE
    return DIFFICULTY_ADVANCED


def _midi_to_guitar_position(midi_note: int) -> Optional[Dict[str, int]]:
    # UI order: high E, B, G, D, A, low E.
    open_string_midis = [64, 59, 55, 50, 45, 40]
    candidates = []
    for string_index, open_midi in enumerate(open_string_midis):
        fret = midi_note - open_midi
        if 0 <= fret <= 20:
            candidates.append((string_index, fret))

    if not candidates:
        return None

    non_open_candidates = [candidate for candidate in candidates if candidate[1] > 0]
    visible_candidates = non_open_candidates or candidates
    string_index, fret = min(visible_candidates, key=lambda item: (item[1] > 12, item[1], abs(item[0] - 2)))
    return {"string_index": string_index, "fret": fret}


def _estimate_pitch_tabs(y: Any, sr: int, tempo: int, duration: float) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    try:
        import librosa
        import numpy as np

        hop_length = 1024
        harmonic_y, _ = librosa.effects.hpss(y)
        source_y = harmonic_y if len(harmonic_y) else y
        beat_duration = 60.0 / max(tempo, 60)
        slot_duration = max(beat_duration * 2, 0.5)
        total_slots = max(8, min(128, int(duration / slot_duration)))

        f0 = librosa.yin(
            source_y,
            fmin=librosa.note_to_hz("E2"),
            fmax=librosa.note_to_hz("E6"),
            sr=sr,
            frame_length=2048,
            hop_length=hop_length,
        )
        frame_times = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=hop_length)
        rms = librosa.feature.rms(y=source_y, frame_length=2048, hop_length=hop_length)[0]
        rms = rms[: len(f0)]
        energy_floor = float(np.percentile(rms, 35)) if len(rms) else 0.0
        valid_mask = np.isfinite(f0) & (f0 > 0) & (rms > energy_floor)

        tabs: List[Dict[str, Any]] = []
        matched_slots = 0
        rendered_notes = 0

        for slot_idx in range(total_slots):
            start = slot_idx * slot_duration
            end = start + slot_duration
            segment_mask = valid_mask & (frame_times >= start) & (frame_times < end)
            segment_pitches = f0[segment_mask]
            segment_rms = rms[segment_mask]

            frets = [0, 0, 0, 0, 0, 0]
            if len(segment_pitches) > 0:
                midi_values = np.rint(librosa.hz_to_midi(segment_pitches)).astype(int)
                unique, inverse = np.unique(midi_values, return_inverse=True)
                weighted_counts = np.bincount(inverse, weights=segment_rms if len(segment_rms) else None)
                ranked_notes = sorted(zip(unique.tolist(), weighted_counts.tolist()), key=lambda item: item[1], reverse=True)

                used_strings = set()
                for midi_note, _count in ranked_notes[:4]:
                    position = _midi_to_guitar_position(int(midi_note))
                    if not position:
                        continue
                    string_index = position["string_index"]
                    if string_index in used_strings:
                        continue
                    frets[string_index] = position["fret"]
                    used_strings.add(string_index)
                    rendered_notes += 1
                    if len(used_strings) >= 1:
                        break

                if used_strings:
                    matched_slots += 1

            tabs.append(
                {
                    "measure": slot_idx + 1,
                    "frets": frets,
                    "notes": ["E", "B", "G", "D", "A", "E"],
                    "technique": "pitch_hpss",
                    "start_time": round(start, 2),
                    "duration": round(slot_duration, 2),
                }
            )

        confidence = matched_slots / max(total_slots, 1)
        return tabs, {
            "pitch_tab_status": "ok",
            "pitch_source": "harmonic_hpss_yin",
            "pitch_matched_measures": matched_slots,
            "pitch_total_measures": total_slots,
            "pitch_tab_confidence": round(confidence, 3),
            "pitch_rendered_notes": rendered_notes,
            "pitch_slot_duration": round(slot_duration, 3),
        }
    except Exception as exc:
        return [], {
            "pitch_tab_status": "failed",
            "reason": "pitch_to_tab_error",
            "detail": str(exc),
        }


def _extract_demucs_guitar_stem(audio_path: str, max_duration: int = 90) -> Tuple[Optional[str], Dict[str, Any]]:
    status = _high_quality_status()
    if not status.get("demucs_available"):
        return None, {
            "stem_separation_status": "unavailable",
            "reason": "missing_demucs",
            "detail": status.get("error", ""),
        }

    try:
        with tempfile.TemporaryDirectory(prefix="tabe-demucs-") as temp_dir:
            temp_path = Path(temp_dir)
            clip_path = temp_path / "input.wav"
            out_dir = temp_path / "separated"
            ffmpeg_cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                audio_path,
                "-t",
                str(max_duration),
                "-ar",
                "44100",
                "-ac",
                "2",
                str(clip_path),
            ]
            subprocess.run(ffmpeg_cmd, check=True, capture_output=True, text=True)

            model = os.getenv("DEMUCS_MODEL", "htdemucs_6s")
            device = os.getenv("DEMUCS_DEVICE", str(status.get("device") or "cpu"))
            demucs_cmd = [
                sys.executable,
                "-m",
                "demucs.separate",
                "-n",
                model,
                "--device",
                device,
                "--jobs",
                "0",
                "--shifts",
                "1",
                "--segment",
                os.getenv("DEMUCS_SEGMENT", "10"),
                "--out",
                str(out_dir),
                str(clip_path),
            ]
            subprocess.run(demucs_cmd, check=True, capture_output=True, text=True, timeout=int(os.getenv("DEMUCS_TIMEOUT_SEC", "900")))

            stem_candidates = sorted(out_dir.glob(f"{model}/input/guitar.wav"))
            if not stem_candidates:
                stem_candidates = sorted(out_dir.glob("*/input/other.wav"))
            if not stem_candidates:
                return None, {
                    "stem_separation_status": "failed",
                    "reason": "stem_file_not_found",
                    "model": model,
                    "device": device,
                }

            final_path = Path(audio_path).with_name(f"{Path(audio_path).stem}.guitar-stem.wav")
            final_path.write_bytes(stem_candidates[0].read_bytes())
            return str(final_path), {
                "stem_separation_status": "ok",
                "stem_source": "guitar" if stem_candidates[0].name == "guitar.wav" else "other",
                "stem_path": str(final_path),
                "model": model,
                "device": device,
                "duration_limit_sec": max_duration,
            }
    except subprocess.TimeoutExpired as exc:
        return None, {
            "stem_separation_status": "failed",
            "reason": "demucs_timeout",
            "detail": str(exc),
        }
    except Exception as exc:
        return None, {
            "stem_separation_status": "failed",
            "reason": "demucs_error",
            "detail": str(exc),
        }


def _analyze_audio_waveform(audio_path: str, quality: str = "balanced") -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    start_total = time.perf_counter()
    try:
        import librosa
        import numpy as np
    except Exception as exc:
        return None, {
            "audio_analysis_status": "unavailable",
            "reason": "missing_dependencies",
            "detail": str(exc),
        }

    try:
        timing: Dict[str, Any] = {
            "analysis_total_sec": 0.0,
            "load_sec": 0.0,
            "stem_sec": 0.0,
            "feature_sec": 0.0,
        }
        source_path = audio_path
        stem_diag: Dict[str, Any] = {"stem_separation_status": "not_requested"}
        if quality == "local_quality":
            stem_start = time.perf_counter()
            stem_path, stem_diag = _extract_demucs_guitar_stem(audio_path)
            timing["stem_sec"] = round(time.perf_counter() - stem_start, 3)
            if stem_path:
                source_path = stem_path

        hop_length = 1024
        load_start = time.perf_counter()
        y, sr = librosa.load(source_path, sr=16000, mono=True, duration=90)
        if y is None or len(y) == 0:
            raise RuntimeError("empty audio signal")
        timing["load_sec"] = round(time.perf_counter() - load_start, 3)

        feature_start = time.perf_counter()
        raw_tempo, _ = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length)
        tempo = _normalize_tempo(raw_tempo)

        chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop_length)
        chroma_mean = np.mean(chroma, axis=1)
        key = _estimate_key(chroma_mean)

        onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)
        duration = float(len(y) / sr)
        onset_density = float(len(onset_times) / max(duration, 1.0))

        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        avg_centroid = float(np.mean(centroid)) if centroid.size else 0.0
        difficulty = _estimate_difficulty(tempo, onset_density, avg_centroid)
        chords = _estimate_chords(chroma, sr, hop_length)
        tabs, pitch_diag = _estimate_pitch_tabs(y, sr, tempo, duration)
        timing["feature_sec"] = round(time.perf_counter() - feature_start, 3)
        timing["analysis_total_sec"] = round(time.perf_counter() - start_total, 3)

        return (
            {
                "tempo": tempo,
                "key": key,
                "difficulty": difficulty,
                "duration": int(round(duration)),
                "chord_progressions": chords,
                "tabs": tabs,
                "analysis_method": "audio_waveform",
                "analysis_timing": timing,
            },
            {
                "audio_analysis_status": "ok",
                "analysis_quality": quality,
                "onset_density": round(onset_density, 3),
                "spectral_centroid": round(avg_centroid, 2),
                "analysis_total_sec": timing["analysis_total_sec"],
                **stem_diag,
                **pitch_diag,
            },
        )
    except Exception as exc:
        return None, {
            "audio_analysis_status": "failed",
            "reason": "audio_decode_or_feature_error",
            "detail": str(exc),
        }


def _build_fallback_analysis(record: Dict[str, Any]) -> Dict[str, Any]:
    base = f"{record.get('source_video_id', '')}:{record.get('title', '')}"
    seed = int(hashlib.sha1(base.encode("utf-8")).hexdigest()[:8], 16)
    rnd = random.Random(seed)

    keys = ["C", "G", "D", "A", "E", "F", "Am", "Em", "Dm"]
    tempo = rnd.randint(90, 155)
    key = rnd.choice(keys)
    duration = max(60, int(record.get("duration") or 180))

    if tempo <= 105:
        difficulty = DIFFICULTY_BEGINNER
    elif tempo <= 138:
        difficulty = DIFFICULTY_INTERMEDIATE
    else:
        difficulty = DIFFICULTY_ADVANCED

    chords = _build_chord_progressions(key=key, duration=duration, rnd=rnd)

    return {
        "tempo": tempo,
        "key": key,
        "difficulty": difficulty,
        "duration": duration,
        "chord_progressions": chords,
        "analysis_method": "metadata_fallback",
    }


def _build_chord_progressions(key: str, duration: int, rnd: random.Random) -> List[Dict[str, Any]]:
    patterns = {
        "C": ["C", "Am", "F", "G"],
        "G": ["G", "Em", "C", "D"],
        "D": ["D", "Bm", "G", "A"],
        "A": ["A", "F#m", "D", "E"],
        "E": ["E", "C#m", "A", "B"],
        "F": ["F", "Dm", "Bb", "C"],
        "Am": ["Am", "F", "C", "G"],
        "Em": ["Em", "C", "G", "D"],
        "Dm": ["Dm", "Bb", "F", "C"],
    }
    selected = patterns.get(key, patterns["C"])
    section = 8
    max_items = min(20, max(6, duration // section))
    result = []
    for i in range(max_items):
        chord = selected[i % len(selected)]
        result.append(
            {
                "chord": chord,
                "start_time": i * section,
                "duration": section,
                "confidence": round(rnd.uniform(0.65, 0.93), 3),
            }
        )
    return result


def _build_tabs(tempo: int, difficulty: str, duration: int, seed: str) -> List[Dict[str, Any]]:
    rnd = random.Random(int(hashlib.md5(seed.encode("utf-8")).hexdigest()[:8], 16))
    max_fret = 4 if difficulty == DIFFICULTY_BEGINNER else 8 if difficulty == DIFFICULTY_INTERMEDIATE else 12

    beat_duration = 60.0 / max(tempo, 60)
    total_measures = max(8, min(64, int(duration / (beat_duration * 4))))

    tabs = []
    for i in range(total_measures):
        frets = [0, 0, 0, 0, 0, 0]
        for _ in range(rnd.randint(1, 3)):
            string_idx = rnd.randint(0, 5)
            frets[string_idx] = rnd.randint(0, max_fret)
        tabs.append(
            {
                "measure": i + 1,
                "frets": frets,
                "notes": ["E", "B", "G", "D", "A", "E"],
                "technique": "basic" if difficulty == DIFFICULTY_BEGINNER else "rhythm" if difficulty == DIFFICULTY_INTERMEDIATE else "lead",
            }
        )

    return tabs


def _build_result_payload(record: Dict[str, Any], analysis: Dict[str, Any], analysis_diagnostics: Dict[str, Any]) -> Dict[str, Any]:
    tempo = int(analysis.get("tempo") or 120)
    key = analysis.get("key") or "C"
    difficulty = analysis.get("difficulty") or DIFFICULTY_INTERMEDIATE
    duration = int(analysis.get("duration") or record.get("duration") or 0)
    analysis_timing = analysis.get("analysis_timing", {})

    seed = f"{record.get('audio_id', '')}:{record.get('source_video_id', '')}:{tempo}:{key}"
    analysis_tabs = analysis.get("tabs") if isinstance(analysis.get("tabs"), list) else []
    tabs = analysis_tabs or _build_tabs(tempo=tempo, difficulty=difficulty, duration=max(60, duration), seed=seed)
    chord_progressions = analysis.get("chord_progressions") or _build_chord_progressions(key, max(60, duration), random.Random(seed))
    fallback_applied = bool(analysis_diagnostics.get("fallback_applied"))
    analysis_method = analysis.get("analysis_method", "unknown")
    result_mode = "audio_verified" if analysis_method == "audio_waveform" and not fallback_applied else "metadata_fallback"

    return {
        "title": record.get("title", "Unknown Title"),
        "artist": record.get("artist", "Unknown Artist"),
        "duration": duration,
        "tempo": tempo,
        "key": key,
        "difficulty": difficulty,
        "tabs": tabs,
        "chord_progressions": chord_progressions,
        "metadata": {
            "view_count": record.get("view_count", 0),
            "upload_date": record.get("upload_date", ""),
            "analysis_method": analysis_method,
            "result_mode": result_mode,
            "status_summary": "실제 오디오 분석 완료" if result_mode == "audio_verified" else "추출 후 메타데이터 폴백 적용",
            "thumbnail": record.get("thumbnail", ""),
            "video_id": record.get("source_video_id", ""),
            "audio_id": record.get("audio_id", ""),
            "audio_ext": record.get("audio_ext", ""),
            "audio_size_bytes": record.get("audio_size_bytes", 0),
            "audio_path": record.get("audio_path", ""),
            "pipeline_status": {
                "youtube_extraction": "ok",
                "audio_analysis": analysis_diagnostics.get("audio_analysis_status", "unknown"),
                "tab_generation": "ok",
            },
            "tab_source": "audio_pitch" if analysis_tabs else "fallback_pattern",
            "pipeline_diagnostics": {
                "extract_attempts": record.get("attempts", []),
                "extract_runtime": record.get("diagnostics", {}),
                "audio_analysis": analysis_diagnostics,
                "analysis_timing": analysis_timing,
            },
        },
    }


def _analyze_record(record: Dict[str, Any], quality: str = "balanced") -> Dict[str, Any]:
    start = time.perf_counter()
    audio_path = record.get("audio_path")
    if not audio_path:
        raise RuntimeError("Saved audio path is missing")

    analysis, audio_diag = _analyze_audio_waveform(audio_path, quality=quality)
    if analysis is None:
        analysis = _build_fallback_analysis(record)
        audio_diag = {
            **audio_diag,
            "fallback_applied": True,
            "fallback_reason": "audio_analysis_failed_or_unavailable",
        }
    else:
        audio_diag = {**audio_diag, "fallback_applied": False}

    payload = _build_result_payload(record, analysis, audio_diag)
    payload["metadata"]["pipeline_diagnostics"]["analysis_runtime_sec"] = round(time.perf_counter() - start, 3)
    return payload


def _append_cache_and_runtime_metric(
    *,
    cache_key: str,
    cache_hit: bool,
    quality: str,
    request_source: str,
    total_sec: float,
    extract_sec: Optional[float],
    analysis_sec: float,
    result_mode: str,
) -> None:
    _record_analysis_metric(
        {
            "cache_key": cache_key,
            "cache_hit": cache_hit,
            "quality": quality,
            "request_source": request_source,
            "result_mode": result_mode,
            "total_sec": round(total_sec, 3),
            "extract_sec": None if extract_sec is None else round(extract_sec, 3),
            "analysis_sec": round(analysis_sec, 3),
        }
    )


def _payload_result_mode(payload: Dict[str, Any]) -> str:
    return payload.get("metadata", {}).get("result_mode", "unknown")


def _payload_analysis_runtime_sec(payload: Dict[str, Any]) -> float:
    return float(
        payload.get("metadata", {})
        .get("pipeline_diagnostics", {})
        .get("analysis_runtime_sec", 0.0)
    )


def _cache_hit_response(
    *,
    cache_key: str,
    quality: str,
    request_source: str,
    payload: Dict[str, Any],
    cached_at: Optional[float],
    request_start: float,
    extract_sec: Optional[float] = None,
) -> ApiResponse:
    _analysis_cache_set_meta(
        payload,
        cache_hit=True,
        cached_at=cached_at,
        request_source=request_source,
    )
    _append_cache_and_runtime_metric(
        cache_key=cache_key,
        cache_hit=True,
        quality=quality,
        request_source=request_source,
        total_sec=time.perf_counter() - request_start,
        extract_sec=extract_sec,
        analysis_sec=_payload_analysis_runtime_sec(payload),
        result_mode=_payload_result_mode(payload),
    )
    return ApiResponse(success=True, data=payload)


async def _run_cached_analysis(
    *,
    cache_key: str,
    quality: str,
    request_source: str,
    compute: Callable[[], Awaitable[Tuple[Dict[str, Any], Optional[float], Dict[str, Any]]]],
) -> ApiResponse:
    request_start = time.perf_counter()

    cached_payload, cached_at = _analysis_cache_get(cache_key)
    if cached_payload is not None:
        return _cache_hit_response(
            cache_key=cache_key,
            quality=quality,
            request_source=request_source,
            payload=cached_payload,
            cached_at=cached_at,
            request_start=request_start,
        )

    lock = _get_inflight_lock(cache_key)
    async with lock:
        cached_payload, cached_at = _analysis_cache_get(cache_key)
        if cached_payload is not None:
            return _cache_hit_response(
                cache_key=cache_key,
                quality=quality,
                request_source=request_source,
                payload=cached_payload,
                cached_at=cached_at,
                request_start=request_start,
            )

        try:
            data, extract_sec, meta_extra = await compute()
        except Exception as exc:
            _record_analysis_failure(
                cache_key=cache_key,
                quality=quality,
                request_source=request_source,
                error=str(exc),
                failed_stage=_failed_stage_for_exception(exc),
                total_sec=time.perf_counter() - request_start,
            )
            raise

        analysis_sec = _payload_analysis_runtime_sec(data)
        _append_cache_and_runtime_metric(
            cache_key=cache_key,
            cache_hit=False,
            quality=quality,
            request_source=request_source,
            total_sec=time.perf_counter() - request_start,
            extract_sec=extract_sec,
            analysis_sec=analysis_sec,
            result_mode=_payload_result_mode(data),
        )
        _analysis_cache_set_meta(
            data,
            cache_hit=False,
            request_source=request_source,
            **meta_extra,
        )
        _analysis_cache_set(cache_key, data)
        return ApiResponse(success=True, data=data)


@app.get("/")
async def root():
    return {"message": "Guitar2Tabs Real Analysis API", "version": "2.0.0", "status": "running"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "audio_pipeline": pipeline.diagnostics(),
            "audio_analysis_deps": _analysis_dependency_status(),
            "cloud_analysis": _cloud_analysis_status(),
            "high_quality": _high_quality_status(),
            "analysis_cache": {
                "maxsize": ANALYSIS_RESULT_CACHE.maxsize,
                "ttl_sec": ANALYSIS_RESULT_CACHE_TTL_SEC,
                "current_size": len(ANALYSIS_RESULT_CACHE),
            },
            "analysis_inflight_locks": {
                "maxsize": ANALYSIS_INFLIGHT_LOCK_MAXSIZE,
                "ttl_sec": ANALYSIS_INFLIGHT_LOCK_TTL_SEC,
                "current_size": len(ANALYSIS_INFLIGHT_LOCKS),
            },
        },
    }


@app.get("/test-audio-analysis", response_model=ApiResponse)
async def test_audio_analysis():
    return ApiResponse(
        success=True,
        data={
            "message": "Audio analysis diagnostics",
            "pipeline": pipeline.diagnostics(),
            "analysis_dependencies": _analysis_dependency_status(),
            "cloud_analysis": _cloud_analysis_status(),
            "high_quality": _high_quality_status(),
        },
    )


@app.get("/analysis-metrics")
async def get_analysis_metrics():
    return {
        "total": len(ANALYSIS_REQUEST_METRICS),
        "cache": {
            "maxsize": ANALYSIS_RESULT_CACHE.maxsize,
            "ttl_sec": ANALYSIS_RESULT_CACHE_TTL_SEC,
            "current_size": len(ANALYSIS_RESULT_CACHE),
        },
        "inflight_locks": {
            "maxsize": ANALYSIS_INFLIGHT_LOCK_MAXSIZE,
            "ttl_sec": ANALYSIS_INFLIGHT_LOCK_TTL_SEC,
            "current_size": len(ANALYSIS_INFLIGHT_LOCKS),
        },
        "recent_requests": list(ANALYSIS_REQUEST_METRICS),
    }


@app.post("/extract-audio", response_model=ApiResponse)
async def extract_audio(request: AnalysisRequest):
    try:
        record = await run_in_threadpool(pipeline.extract_audio, request.url)
        return ApiResponse(success=True, data=record)
    except AudioExtractionError as exc:
        logger.error("Audio extraction failed: %s", exc)
        return _analysis_error_response(str(exc), failed_stage="youtube_extraction", data={"diagnostics": exc.diagnostics})
    except Exception as exc:
        logger.error("Unexpected extraction error: %s", exc)
        return _analysis_error_response(str(exc), failed_stage="youtube_extraction")


@app.post("/upload-audio", response_model=ApiResponse)
async def upload_audio(
    file: UploadFile = File(..., description="Audio file (wav/mp3/m4a/...)"),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None),
):
    """Friend-friendly path: upload local audio when YouTube URL extraction is blocked."""
    try:
        payload = await file.read()
        filename = file.filename or "upload.wav"

        def _ingest() -> Dict[str, Any]:
            return pipeline.ingest_uploaded_audio(
                filename=filename,
                data=payload,
                title=title,
                artist=artist,
            )

        record = await run_in_threadpool(_ingest)
        return ApiResponse(success=True, data=record)
    except ValueError as exc:
        logger.warning("Upload rejected: %s", exc)
        return _analysis_error_response(str(exc), failed_stage="audio_upload")
    except Exception as exc:
        logger.error("Upload failed: %s", exc)
        return _analysis_error_response(str(exc), failed_stage="audio_upload")


@app.post("/analyze-upload", response_model=ApiResponse)
async def analyze_upload(
    file: UploadFile = File(..., description="Audio file (wav/mp3/m4a/...)"),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None),
    quality: str = Form("balanced"),
):
    """Upload audio then run analysis in one request (no YouTube dependency)."""
    try:
        payload = await file.read()
        filename = file.filename or "upload.wav"

        def _ingest() -> Dict[str, Any]:
            return pipeline.ingest_uploaded_audio(
                filename=filename,
                data=payload,
                title=title,
                artist=artist,
            )

        record = await run_in_threadpool(_ingest)
        resolved_quality = "local_quality" if quality == "local_quality" else "balanced"
        cache_key = _analysis_cache_key("audio_id", record["audio_id"], resolved_quality)

        async def compute() -> Tuple[Dict[str, Any], Optional[float], Dict[str, Any]]:
            data = await run_in_threadpool(_analyze_record, record, resolved_quality)
            return data, None, {"source_type": "upload", "audio_id": record["audio_id"]}

        return await _run_cached_analysis(
            cache_key=cache_key,
            quality=resolved_quality,
            request_source="analyze_upload",
            compute=compute,
        )
    except ValueError as exc:
        logger.warning("Analyze-upload rejected: %s", exc)
        return _analysis_error_response(str(exc), failed_stage="audio_upload")
    except Exception as exc:
        logger.error("Analyze-upload failed: %s", exc)
        return _analysis_error_response(str(exc), failed_stage=_failed_stage_for_exception(exc))


@app.get("/audio/{audio_id}", response_model=ApiResponse)
async def get_audio_record(audio_id: str):
    try:
        record = pipeline.load_record(audio_id)
        return ApiResponse(success=True, data=record)
    except FileNotFoundError as exc:
        logger.warning("Audio record not found: %s", audio_id)
        return _analysis_error_response(str(exc), failed_stage="audio_not_found", data={"audio_id": audio_id})
    except Exception as exc:
        logger.error("Failed to load audio record %s: %s", audio_id, exc)
        return _analysis_error_response(str(exc), failed_stage="audio_load")


@app.get("/audio/{audio_id}/stream")
async def stream_audio(audio_id: str):
    try:
        record = pipeline.load_record(audio_id)
        audio_path = await run_in_threadpool(pipeline.resolve_stream_path, record)
    except FileNotFoundError:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Audio not found")

    if not audio_path.is_file():
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Audio file missing on disk")

    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
        ".opus": "audio/opus",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(audio_path.suffix.lower(), "application/octet-stream")
    # inline + filename helps browsers stream in <audio> instead of forcing download
    return FileResponse(
        audio_path,
        media_type=media_type,
        filename=audio_path.name,
        content_disposition_type="inline",
    )


@app.post("/analyze-from-audio", response_model=ApiResponse)
async def analyze_from_audio(request: AnalyzeFromAudioRequest):
    try:
        record = pipeline.load_record(request.audio_id)
        quality = "local_quality" if request.quality == "local_quality" else "balanced"
        cache_key = _analysis_cache_key("audio_id", request.audio_id, quality)

        async def compute() -> Tuple[Dict[str, Any], Optional[float], Dict[str, Any]]:
            data = await run_in_threadpool(_analyze_record, record, quality)
            return data, None, {}

        return await _run_cached_analysis(
            cache_key=cache_key,
            quality=quality,
            request_source="analyze_from_audio",
            compute=compute,
        )
    except FileNotFoundError as exc:
        logger.warning("Analyze-from-audio missing record: %s", request.audio_id)
        return _analysis_error_response(
            str(exc),
            failed_stage="audio_not_found",
            data={"audio_id": request.audio_id},
        )
    except Exception as exc:
        logger.error("Analyze-from-audio failed: %s", exc)
        return _analysis_error_response(str(exc), failed_stage=_failed_stage_for_exception(exc))


@app.post("/analyze", response_model=ApiResponse)
async def analyze_music(request: AnalysisRequest):
    try:
        if request.quality == "cloud":
            cloud_start = time.perf_counter()
            cloud_response = await run_in_threadpool(_forward_to_cloud_analysis, request)
            if cloud_response is not None:
                if not cloud_response.success:
                    cloud_data = cloud_response.data or {}
                    _record_analysis_failure(
                        cache_key=_analysis_cache_key("url", request.url, "cloud"),
                        quality="cloud",
                        request_source="analyze",
                        error=cloud_response.error or "cloud_analysis_failed",
                        failed_stage=str(cloud_data.get("failed_stage", "cloud_analysis")),
                        total_sec=time.perf_counter() - cloud_start,
                    )
                return cloud_response

        quality = "local_quality" if request.quality == "local_quality" else "balanced"
        cache_key = _analysis_cache_key("url", request.url, quality)

        async def compute() -> Tuple[Dict[str, Any], Optional[float], Dict[str, Any]]:
            extraction_start = time.perf_counter()
            record = await run_in_threadpool(pipeline.extract_audio, request.url)
            extract_sec = time.perf_counter() - extraction_start
            analyze_start = time.perf_counter()
            data = await run_in_threadpool(_analyze_record, record, quality)
            analysis_sec = time.perf_counter() - analyze_start
            total_sec = extract_sec + analysis_sec
            return data, extract_sec, {
                "extract_sec": round(extract_sec, 3),
                "analysis_sec": round(analysis_sec, 3),
                "total_sec": round(total_sec, 3),
            }

        return await _run_cached_analysis(
            cache_key=cache_key,
            quality=quality,
            request_source="analyze",
            compute=compute,
        )
    except AudioExtractionError as exc:
        logger.error("Analyze failed at extraction stage: %s", exc)
        return _analysis_error_response(
            "Audio extraction failed before analysis",
            failed_stage="youtube_extraction",
            data={"diagnostics": exc.diagnostics},
        )
    except Exception as exc:
        logger.error("Analyze failed unexpectedly: %s", exc)
        return _analysis_error_response(str(exc), failed_stage=_failed_stage_for_exception(exc))


@app.post("/analyze-audio", response_model=ApiResponse)
async def analyze_audio_alias(request: AnalysisRequest):
    return await analyze_music(request)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
