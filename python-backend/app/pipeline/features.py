"""템포 / 조성 / 코드 진행 등 곡 단위 특징 추출."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

# Krumhansl-Schmuckler 조성 프로파일.
_MAJOR_PROFILE = (6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88)
_MINOR_PROFILE = (6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17)

# 코드 템플릿: 근음 기준 반음 간격.
_CHORD_INTERVALS: Dict[str, Tuple[int, ...]] = {
    "": (0, 4, 7),          # major
    "m": (0, 3, 7),         # minor
    "7": (0, 4, 7, 10),     # dominant 7th
    "maj7": (0, 4, 7, 11),
    "m7": (0, 3, 7, 10),
    "sus4": (0, 5, 7),
    "dim": (0, 3, 6),
}


@dataclass
class AudioFeatures:
    tempo: int = 120
    key: str = "C"
    beat_times: List[float] = field(default_factory=list)
    downbeat_times: List[float] = field(default_factory=list)
    chords: List[Dict[str, Any]] = field(default_factory=list)
    duration: float = 0.0
    onset_density: float = 0.0
    diagnostics: Dict[str, Any] = field(default_factory=dict)


def normalize_tempo(raw: Any, low: int = 50, high: int = 220) -> int:
    """numpy 스칼라/배열을 안전하게 정수 BPM 으로 변환한다."""
    try:
        if hasattr(raw, "item"):
            raw = raw.item()
        elif isinstance(raw, (list, tuple)) and raw:
            raw = raw[0]
        tempo = float(raw)
    except Exception:
        return 120

    if tempo <= 0:
        return 120
    # 배음/반음 오검출 보정: 지나치게 빠르거나 느리면 배수로 접는다.
    while tempo > high:
        tempo /= 2
    while tempo < low:
        tempo *= 2
    return int(round(max(low, min(high, tempo))))


def estimate_key(chroma_mean: Any) -> str:
    """장/단조 프로파일 상관으로 조성을 추정한다."""
    try:
        import numpy as np

        vector = np.asarray(chroma_mean, dtype=float)
        norm = np.linalg.norm(vector)
        if norm <= 0:
            return "C"
        vector = vector / norm

        best_key, best_score = "C", -1.0
        for shift in range(12):
            for suffix, profile in (("", _MAJOR_PROFILE), ("m", _MINOR_PROFILE)):
                rolled = np.roll(np.asarray(profile, dtype=float), shift)
                rolled = rolled / np.linalg.norm(rolled)
                score = float(np.dot(vector, rolled))
                if score > best_score:
                    best_score = score
                    best_key = f"{NOTE_NAMES[shift]}{suffix}"
        return best_key
    except Exception:
        return "C"


def _chord_templates() -> Dict[str, Any]:
    import numpy as np

    templates: Dict[str, Any] = {}
    for root_index, root_name in enumerate(NOTE_NAMES):
        for suffix, intervals in _CHORD_INTERVALS.items():
            vector = np.zeros(12, dtype=float)
            for interval in intervals:
                vector[(root_index + interval) % 12] = 1.0
            vector /= np.linalg.norm(vector)
            templates[f"{root_name}{suffix}"] = vector
    return templates


def estimate_chords(
    chroma: Any,
    times: Any,
    beat_times: List[float],
    max_chords: int = 64,
) -> List[Dict[str, Any]]:
    """비트 그리드에 맞춰 코드 진행을 추정한다.

    고정 프레임 수로 자르던 기존 방식과 달리, 실제 비트 경계를 쓰기 때문에
    코드 변화 지점이 음악적으로 맞아떨어진다.
    """
    try:
        import numpy as np

        templates = _chord_templates()
        segments = _segment_boundaries(times, beat_times, max_chords)

        result: List[Dict[str, Any]] = []
        for start_time, end_time in segments:
            mask = (times >= start_time) & (times < end_time)
            if not bool(np.any(mask)):
                continue
            segment = np.mean(chroma[:, mask], axis=1)
            norm = np.linalg.norm(segment)
            if norm <= 0:
                continue
            segment = segment / norm

            best_chord, best_score = "C", -1.0
            for name, template in templates.items():
                score = float(np.dot(segment, template))
                if score > best_score:
                    best_score = score
                    best_chord = name

            # 같은 코드가 이어지면 앞 구간에 합친다.
            if result and result[-1]["chord"] == best_chord:
                previous = result[-1]
                previous["duration"] = round(end_time - previous["start_time"], 2)
                previous["confidence"] = round(max(previous["confidence"], best_score), 3)
                continue

            result.append(
                {
                    "chord": best_chord,
                    "start_time": round(float(start_time), 2),
                    "duration": round(float(end_time - start_time), 2),
                    "confidence": round(max(0.1, min(0.99, best_score)), 3),
                }
            )

        return result
    except Exception as exc:
        logger.warning("Chord estimation failed: %s", exc)
        return []


def _segment_boundaries(times: Any, beat_times: List[float], max_segments: int) -> List[Tuple[float, float]]:
    """코드 추정을 위한 구간 경계. 비트가 있으면 2비트 단위, 없으면 균등 분할."""
    total = float(times[-1]) if len(times) else 0.0
    if total <= 0:
        return []

    if len(beat_times) >= 4:
        step = 2  # 2비트마다 코드 후보
        boundaries = [beat_times[i] for i in range(0, len(beat_times), step)]
        if boundaries[-1] < total:
            boundaries.append(total)
    else:
        count = min(max_segments, max(4, int(total // 2)))
        boundaries = [total * i / count for i in range(count + 1)]

    segments = [(boundaries[i], boundaries[i + 1]) for i in range(len(boundaries) - 1)]
    return segments[:max_segments]


def extract_features(y: Any, sr: int) -> AudioFeatures:
    """파형에서 템포/비트/조성/코드를 뽑는다."""
    try:
        import librosa
        import numpy as np
    except Exception as exc:
        return AudioFeatures(
            diagnostics={
                "feature_status": "unavailable",
                "reason": "missing_dependencies",
                "detail": str(exc),
            }
        )

    try:
        hop_length = 512
        duration = float(len(y) / sr)

        raw_tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length, units="frames")
        tempo = normalize_tempo(raw_tempo)
        beat_times = [float(t) for t in librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)]

        # 4/4 기준 매 4번째 비트를 마디 시작으로 본다.
        downbeat_times = beat_times[::4]

        # CQT 기반 크로마가 STFT 크로마보다 배음에 강하다.
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
        chroma_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=hop_length)
        key = estimate_key(np.mean(chroma, axis=1))
        chords = estimate_chords(chroma, chroma_times, beat_times)

        onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
        onset_density = float(len(onset_frames) / max(duration, 1.0))

        return AudioFeatures(
            tempo=tempo,
            key=key,
            beat_times=beat_times,
            downbeat_times=[float(t) for t in downbeat_times],
            chords=chords,
            duration=duration,
            onset_density=round(onset_density, 3),
            diagnostics={
                "feature_status": "ok",
                "beat_count": len(beat_times),
                "chord_count": len(chords),
                "chroma": "cqt",
            },
        )
    except Exception as exc:
        logger.warning("Feature extraction failed: %s", exc)
        return AudioFeatures(
            diagnostics={
                "feature_status": "failed",
                "reason": "feature_error",
                "detail": str(exc),
            }
        )
