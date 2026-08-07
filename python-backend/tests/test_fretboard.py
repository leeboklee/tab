"""fretboard.py 단위 테스트. 외부 의존성 없이 순수 파이썬으로 동작해야 한다."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.pipeline.fretboard import (  # noqa: E402
    STANDARD_TUNING_MIDI,
    candidate_positions,
    detect_techniques,
    optimize_fingering,
    shape_to_frets,
    summarize_difficulty,
)


def test_candidate_positions_open_e_string():
    # 6번줄 개방 E2 = midi 40
    positions = candidate_positions(40)
    assert any(p.string_index == 5 and p.fret == 0 for p in positions)


def test_candidate_positions_out_of_range_returns_empty():
    assert candidate_positions(20) == []  # 너무 낮은 음


def test_optimize_fingering_single_note_picks_open_string_when_possible():
    # open high-E (midi 64) 는 개방현으로 칠 수 있어야 한다: 프렛 0을 우선해야 함.
    shapes = optimize_fingering([[64]])
    assert len(shapes) == 1
    frets = shape_to_frets(shapes[0])
    # 어떤 줄이든 프렛 0으로 배치되어야 한다 (개방현 선호).
    assert 0 in [f for f in frets if f is not None]


def test_optimize_fingering_chord_uses_distinct_strings():
    # C major triad: C4=60, E4=64, G4=67 동시 연주
    shapes = optimize_fingering([[60, 64, 67]])
    shape = shapes[0]
    string_indices = [p.string_index for p in shape.placements]
    assert len(string_indices) == len(set(string_indices))  # 줄 중복 없음
    assert len(shape.placements) == 3


def test_optimize_fingering_prefers_minimal_hand_movement():
    # 같은 음을 여러 프레임 반복하면 손이 계속 왔다갔다 하면 안 된다.
    frames = [[60], [62], [60], [62]] * 3
    shapes = optimize_fingering(frames)
    positions = [s.position for s in shapes if s.position is not None]
    # 위치가 위치를 잡았다면 인접 프레임 간 이동폭이 과도하게 크지 않아야 한다.
    for a, b in zip(positions, positions[1:]):
        assert abs(a - b) <= 5


def test_detect_techniques_labels_chord_and_single_note():
    from app.pipeline.fretboard import Placement, Shape

    chord_shape = Shape(placements=(Placement(0, 0, 64), Placement(1, 1, 60), Placement(2, 0, 55)))
    single_shape = Shape(placements=(Placement(0, 3, 67),))

    assert "chord" in detect_techniques(None, chord_shape)
    assert "single_note" in detect_techniques(None, single_shape)


def test_summarize_difficulty_returns_korean_labels():
    from app.pipeline.fretboard import Placement, Shape

    easy = [Shape(placements=(Placement(5, 0, 40),))]
    assert summarize_difficulty(easy, tempo=80, notes_per_second=1.0) == "초급"

    hard = [Shape(placements=(Placement(0, 14, 78), Placement(1, 12, 71), Placement(2, 15, 70)))]
    assert summarize_difficulty(hard, tempo=180, notes_per_second=6.0) == "고급"


def test_optimize_fingering_empty_input():
    assert optimize_fingering([]) == []
