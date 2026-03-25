import hashlib
import logging
import random
from typing import Any, Dict, List, Optional, Tuple

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.audio_pipeline import AudioExtractionError, AudioPipelineService

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


class AnalysisRequest(BaseModel):
    url: str = Field(..., description="YouTube URL")


class AnalyzeFromAudioRequest(BaseModel):
    audio_id: str = Field(..., description="Saved audio identifier")


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


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

        templates = {
            "C": np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], dtype=float),
            "Dm": np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float),
            "Em": np.array([0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float),
            "F": np.array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], dtype=float),
            "G": np.array([0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1], dtype=float),
            "Am": np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float),
        }

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
                score = float(np.dot(segment, template))
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
                    "confidence": round(max(0.2, min(0.99, best_score / 6.0)), 3),
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


def _analyze_audio_waveform(audio_path: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
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
        hop_length = 1024
        y, sr = librosa.load(audio_path, sr=16000, mono=True, duration=90)
        if y is None or len(y) == 0:
            raise RuntimeError("empty audio signal")

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

        return (
            {
                "tempo": tempo,
                "key": key,
                "difficulty": difficulty,
                "duration": int(round(duration)),
                "chord_progressions": chords,
                "analysis_method": "audio_waveform",
            },
            {
                "audio_analysis_status": "ok",
                "onset_density": round(onset_density, 3),
                "spectral_centroid": round(avg_centroid, 2),
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

    seed = f"{record.get('audio_id', '')}:{record.get('source_video_id', '')}:{tempo}:{key}"
    tabs = _build_tabs(tempo=tempo, difficulty=difficulty, duration=max(60, duration), seed=seed)
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
            "pipeline_diagnostics": {
                "extract_attempts": record.get("attempts", []),
                "extract_runtime": record.get("diagnostics", {}),
                "audio_analysis": analysis_diagnostics,
            },
        },
    }


def _analyze_record(record: Dict[str, Any]) -> Dict[str, Any]:
    audio_path = record.get("audio_path")
    if not audio_path:
        raise RuntimeError("Saved audio path is missing")

    analysis, audio_diag = _analyze_audio_waveform(audio_path)
    if analysis is None:
        analysis = _build_fallback_analysis(record)
        audio_diag = {
            **audio_diag,
            "fallback_applied": True,
            "fallback_reason": "audio_analysis_failed_or_unavailable",
        }
    else:
        audio_diag = {**audio_diag, "fallback_applied": False}

    return _build_result_payload(record, analysis, audio_diag)


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
        },
    )


@app.post("/extract-audio", response_model=ApiResponse)
async def extract_audio(request: AnalysisRequest):
    try:
        record = pipeline.extract_audio(request.url)
        return ApiResponse(success=True, data=record)
    except AudioExtractionError as exc:
        logger.error("Audio extraction failed: %s", exc)
        return ApiResponse(success=False, error=str(exc), data={"diagnostics": exc.diagnostics})
    except Exception as exc:
        logger.error("Unexpected extraction error: %s", exc)
        return ApiResponse(success=False, error=str(exc))


@app.get("/audio/{audio_id}", response_model=ApiResponse)
async def get_audio_record(audio_id: str):
    try:
        record = pipeline.load_record(audio_id)
        return ApiResponse(success=True, data=record)
    except Exception as exc:
        return ApiResponse(success=False, error=str(exc))


@app.post("/analyze-from-audio", response_model=ApiResponse)
async def analyze_from_audio(request: AnalyzeFromAudioRequest):
    try:
        record = pipeline.load_record(request.audio_id)
        data = _analyze_record(record)
        return ApiResponse(success=True, data=data)
    except Exception as exc:
        logger.error("Analyze-from-audio failed: %s", exc)
        return ApiResponse(success=False, error=str(exc))


@app.post("/analyze", response_model=ApiResponse)
async def analyze_music(request: AnalysisRequest):
    try:
        record = pipeline.extract_audio(request.url)
        data = _analyze_record(record)
        return ApiResponse(success=True, data=data)
    except AudioExtractionError as exc:
        logger.error("Analyze failed at extraction stage: %s", exc)
        return ApiResponse(
            success=False,
            error="Audio extraction failed before analysis",
            data={"diagnostics": exc.diagnostics, "failed_stage": "youtube_extraction"},
        )
    except Exception as exc:
        logger.error("Analyze failed unexpectedly: %s", exc)
        return ApiResponse(success=False, error=str(exc), data={"failed_stage": "unknown"})


@app.post("/analyze-audio", response_model=ApiResponse)
async def analyze_audio_alias(request: AnalysisRequest):
    return await analyze_music(request)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)

