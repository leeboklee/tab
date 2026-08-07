"""합성 신호로 전체 파이프라인(특징추출 -> 채보 폴백 -> 타브 조립) 검증.

실제 음원 없이도 CI 에서 돌 수 있게 사인파를 직접 만든다.
librosa 가 없으면 이 파일 전체를 건너뛴다.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

librosa = pytest.importorskip("librosa")
numpy = pytest.importorskip("numpy")

from app.pipeline import features, tab, transcription  # noqa: E402


def _make_chord_progression(sr: int = 22050, note_seconds: float = 0.6):
    """C - G - Am - F 코드를 순서대로 재생하는 합성 신호."""
    import numpy as np

    chords_hz = {
        "C": [261.63, 329.63, 392.00],
        "G": [392.00, 493.88, 587.33],
        "Am": [220.00, 261.63, 329.63],
        "F": [174.61, 220.00, 261.63],
    }

    segments = []
    for freqs in chords_hz.values():
        t = np.linspace(0, note_seconds, int(sr * note_seconds), endpoint=False)
        wave = sum(np.sin(2 * np.pi * f * t) for f in freqs) / len(freqs)
        # 급격한 클릭 방지용 페이드.
        fade = min(200, len(wave) // 4)
        envelope = np.ones_like(wave)
        envelope[:fade] = np.linspace(0, 1, fade)
        envelope[-fade:] = np.linspace(1, 0, fade)
        segments.append((wave * envelope).astype(np.float32))

    return np.concatenate(segments), sr


def test_feature_extraction_runs_on_synthetic_audio():
    y, sr = _make_chord_progression()
    result = features.extract_features(y, sr)

    assert result.diagnostics.get("feature_status") == "ok"
    assert 40 <= result.tempo <= 220
    assert result.duration > 0


def test_librosa_fallback_transcription_finds_notes():
    y, sr = _make_chord_progression()
    result = transcription.transcribe_librosa(y, sr)

    assert result.diagnostics.get("transcription_status") in {"ok", "empty"}
    # 명확한 화음 신호이므로 최소 하나 이상의 음은 잡혀야 한다.
    assert len(result.notes) > 0


def test_build_tab_produces_measures_from_notes():
    y, sr = _make_chord_progression()
    feats = features.extract_features(y, sr)
    transcript = transcription.transcribe_librosa(y, sr)

    result = tab.build_tab(
        transcript.notes,
        beat_times=feats.beat_times,
        tempo=feats.tempo,
        duration=feats.duration,
    )

    assert result.diagnostics.get("tab_status") in {"ok", "empty"}
    if result.measures:
        first = result.measures[0]
        assert "frets" in first and len(first["frets"]) == 6
        assert first["measure"] == 1


def test_build_tab_empty_notes_returns_empty_result():
    result = tab.build_tab([], beat_times=[], tempo=120, duration=10.0)
    assert result.measures == []
    assert result.diagnostics["tab_status"] == "empty"
