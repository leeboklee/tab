"""다성(polyphonic) 음정 채보.

기존 구현은 `librosa.yin` 단선율 추적으로 슬롯당 음을 하나만 뽑았다.
기타는 화음 악기라 그 방식으로는 타브가 원리적으로 나올 수 없다.

여기서는 Spotify 의 Basic Pitch (Apache-2.0, CNN 기반 다성 채보) 를 1순위로
쓰고, 설치되어 있지 않으면 librosa 의 피치 살리언스로 자동 폴백한다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# 기타 음역: 6번줄 개방 E2(82.4Hz) ~ 1번줄 20프렛 근처 C6.
GUITAR_MIN_HZ = 78.0
GUITAR_MAX_HZ = 1400.0
GUITAR_MIN_MIDI = 40  # E2
GUITAR_MAX_MIDI = 88  # E6


@dataclass
class NoteEvent:
    """채보된 음 하나."""

    start: float
    end: float
    midi: int
    confidence: float = 1.0

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class TranscriptionResult:
    notes: List[NoteEvent] = field(default_factory=list)
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return bool(self.notes)


def basic_pitch_available() -> bool:
    try:
        import basic_pitch  # noqa: F401

        return True
    except Exception:
        return False


def _clamp_to_guitar_range(midi: int) -> Optional[int]:
    """기타 음역 밖의 음은 옥타브를 접어 넣고, 그래도 안 되면 버린다."""
    while midi < GUITAR_MIN_MIDI:
        midi += 12
    while midi > GUITAR_MAX_MIDI:
        midi -= 12
    return midi if GUITAR_MIN_MIDI <= midi <= GUITAR_MAX_MIDI else None


def transcribe_basic_pitch(
    audio_path: str,
    onset_threshold: float = 0.5,
    frame_threshold: float = 0.3,
    minimum_note_length_ms: float = 90.0,
) -> TranscriptionResult:
    """Basic Pitch 로 다성 채보를 수행한다."""
    try:
        from basic_pitch.inference import predict
    except Exception as exc:
        return TranscriptionResult(
            diagnostics={
                "transcription_status": "unavailable",
                "engine": "basic_pitch",
                "reason": "basic_pitch_not_installed",
                "detail": str(exc),
            }
        )

    try:
        predict_kwargs: Dict[str, Any] = {
            "onset_threshold": onset_threshold,
            "frame_threshold": frame_threshold,
            "minimum_note_length": minimum_note_length_ms,
            "minimum_frequency": GUITAR_MIN_HZ,
            "maximum_frequency": GUITAR_MAX_HZ,
        }
        try:
            from basic_pitch import ICASSP_2022_MODEL_PATH

            predict_kwargs["model_or_model_path"] = ICASSP_2022_MODEL_PATH
        except Exception:
            pass  # 최신 버전은 기본 모델을 알아서 고른다.

        _model_output, _midi_data, note_events = predict(audio_path, **predict_kwargs)

        notes: List[NoteEvent] = []
        for event in note_events:
            # (start, end, pitch_midi, amplitude, [pitch_bend])
            start, end, pitch, amplitude = float(event[0]), float(event[1]), int(event[2]), float(event[3])
            midi = _clamp_to_guitar_range(pitch)
            if midi is None:
                continue
            notes.append(
                NoteEvent(start=start, end=end, midi=midi, confidence=max(0.0, min(1.0, amplitude)))
            )

        notes.sort(key=lambda n: (n.start, -n.midi))
        return TranscriptionResult(
            notes=notes,
            diagnostics={
                "transcription_status": "ok" if notes else "empty",
                "engine": "basic_pitch",
                "note_count": len(notes),
                "onset_threshold": onset_threshold,
                "frame_threshold": frame_threshold,
            },
        )
    except Exception as exc:
        logger.warning("Basic Pitch transcription failed: %s", exc)
        return TranscriptionResult(
            diagnostics={
                "transcription_status": "failed",
                "engine": "basic_pitch",
                "reason": "inference_error",
                "detail": str(exc),
            }
        )


def transcribe_librosa(y: Any, sr: int) -> TranscriptionResult:
    """Basic Pitch 가 없을 때 쓰는 폴백.

    단선율 yin 대신 하모닉 성분의 CQT 살리언스에서 프레임별 상위 피크를
    뽑아내므로, 최소한 화음은 잡아낸다.
    """
    try:
        import librosa
        import numpy as np
    except Exception as exc:
        return TranscriptionResult(
            diagnostics={
                "transcription_status": "unavailable",
                "engine": "librosa_cqt",
                "reason": "missing_dependencies",
                "detail": str(exc),
            }
        )

    try:
        hop_length = 512
        harmonic = librosa.effects.harmonic(y, margin=3.0)
        source = harmonic if harmonic.size else y

        cqt = np.abs(
            librosa.cqt(
                source,
                sr=sr,
                hop_length=hop_length,
                fmin=librosa.midi_to_hz(GUITAR_MIN_MIDI),
                n_bins=GUITAR_MAX_MIDI - GUITAR_MIN_MIDI + 1,
                bins_per_octave=12,
            )
        )
        if cqt.size == 0:
            raise RuntimeError("empty CQT")

        # 프레임별 정규화 후 임계값을 넘는 빈을 활성 음으로 본다.
        peak = float(np.max(cqt)) or 1.0
        norm = cqt / peak
        active = norm > 0.18

        times = librosa.frames_to_time(np.arange(norm.shape[1]), sr=sr, hop_length=hop_length)
        frame_step = float(times[1] - times[0]) if len(times) > 1 else hop_length / sr

        notes: List[NoteEvent] = []
        # 빈(=음정)별로 연속 구간을 묶어 노트 이벤트로 만든다.
        for bin_index in range(active.shape[0]):
            midi = GUITAR_MIN_MIDI + bin_index
            run_start: Optional[int] = None
            for frame_index in range(active.shape[1]):
                if active[bin_index, frame_index]:
                    if run_start is None:
                        run_start = frame_index
                elif run_start is not None:
                    _append_run(notes, norm, bin_index, midi, run_start, frame_index, times, frame_step)
                    run_start = None
            if run_start is not None:
                _append_run(notes, norm, bin_index, midi, run_start, active.shape[1], times, frame_step)

        notes.sort(key=lambda n: (n.start, -n.midi))
        return TranscriptionResult(
            notes=notes,
            diagnostics={
                "transcription_status": "ok" if notes else "empty",
                "engine": "librosa_cqt",
                "note_count": len(notes),
                "fallback": True,
            },
        )
    except Exception as exc:
        logger.warning("librosa CQT transcription failed: %s", exc)
        return TranscriptionResult(
            diagnostics={
                "transcription_status": "failed",
                "engine": "librosa_cqt",
                "reason": "cqt_error",
                "detail": str(exc),
            }
        )


def _append_run(
    notes: List[NoteEvent],
    norm: Any,
    bin_index: int,
    midi: int,
    start_frame: int,
    end_frame: int,
    times: Any,
    frame_step: float,
) -> None:
    """연속 활성 구간 하나를 노트 이벤트로 추가한다. 너무 짧으면 버린다."""
    min_frames = max(2, int(0.05 / max(frame_step, 1e-6)))
    if end_frame - start_frame < min_frames:
        return

    start = float(times[start_frame])
    end = float(times[min(end_frame, len(times) - 1)])
    if end <= start:
        end = start + frame_step

    confidence = float(norm[bin_index, start_frame:end_frame].mean())
    notes.append(NoteEvent(start=start, end=end, midi=midi, confidence=confidence))


def transcribe(
    audio_path: str,
    y: Any = None,
    sr: int = 22050,
    onset_threshold: float = 0.5,
    frame_threshold: float = 0.3,
    minimum_note_length_ms: float = 90.0,
) -> TranscriptionResult:
    """Basic Pitch 우선, 실패 시 librosa 폴백."""
    result = transcribe_basic_pitch(
        audio_path,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length_ms=minimum_note_length_ms,
    )
    if result.ok:
        return result

    primary_diagnostics = result.diagnostics
    if y is None:
        return result

    fallback = transcribe_librosa(y, sr)
    fallback.diagnostics["primary_engine_diagnostics"] = primary_diagnostics
    return fallback
