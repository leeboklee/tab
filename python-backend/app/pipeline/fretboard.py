"""MIDI 노트 -> 기타 지판 배치.

기존 구현은 노트마다 독립적으로 `min()` 을 돌리는 그리디 방식이라
직전 프레임의 손 위치를 전혀 고려하지 않았다. 그 결과 1프렛과 12프렛을
오가는 연주 불가능한 타브가 나왔다.

여기서는 프레임(동시에 울리는 음 묶음)마다 후보 운지 "shape" 를 만들고,
shape 사이 이동 비용까지 포함한 최단 경로를 비터비(DP)로 찾는다.
순수 파이썬이라 무거운 의존성 없이 단독 테스트가 가능하다.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

# UI 표시 순서와 동일하게 1번줄(고음 E)부터. string_index 0 = high E.
STANDARD_TUNING_MIDI: Tuple[int, ...] = (64, 59, 55, 50, 45, 40)
STRING_NAMES: Tuple[str, ...] = ("E", "B", "G", "D", "A", "E")

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

# shape 하나당 유지할 후보 수. 늘리면 정확도가 오르고 느려진다.
_MAX_SHAPES_PER_FRAME = 24


@dataclass(frozen=True)
class Placement:
    """노트 하나의 지판 위치."""

    string_index: int
    fret: int
    midi: int

    @property
    def is_open(self) -> bool:
        return self.fret == 0


@dataclass(frozen=True)
class Shape:
    """한 프레임에서 동시에 눌리는 운지 형태."""

    placements: Tuple[Placement, ...]

    @property
    def fretted(self) -> Tuple[int, ...]:
        return tuple(p.fret for p in self.placements if p.fret > 0)

    @property
    def span(self) -> int:
        fretted = self.fretted
        return (max(fretted) - min(fretted)) if fretted else 0

    @property
    def position(self) -> Optional[int]:
        """검지가 놓이는 위치. 개방현만 있으면 None."""
        fretted = self.fretted
        return min(fretted) if fretted else None


def midi_to_note_name(midi: int) -> str:
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def candidate_positions(
    midi: int,
    tuning: Sequence[int] = STANDARD_TUNING_MIDI,
    max_fret: int = 20,
) -> List[Placement]:
    """해당 음을 낼 수 있는 모든 (줄, 프렛) 조합."""
    out: List[Placement] = []
    for string_index, open_midi in enumerate(tuning):
        fret = midi - open_midi
        if 0 <= fret <= max_fret:
            out.append(Placement(string_index=string_index, fret=fret, midi=midi))
    return out


def _shape_cost(shape: Shape, max_hand_span: int) -> float:
    """운지 자체의 난이도. 낮을수록 치기 쉽다."""
    if not shape.placements:
        return 0.0

    cost = 0.0
    fretted = shape.fretted

    if fretted:
        span = max(fretted) - min(fretted)
        # 손가락이 벌어지는 폭. 한계를 넘으면 급격히 비싸진다.
        cost += span * 1.5
        if span > max_hand_span:
            cost += (span - max_hand_span) * 12.0

        # 같은 조건이면 로우 포지션을 선호한다.
        cost += min(fretted) * 0.35

        # 하이 프렛은 물리적으로 연주가 까다롭다.
        cost += sum(max(0, fret - 12) * 0.6 for fret in fretted)

    # 개방현은 운지 부담이 없으므로 소폭 보상.
    cost -= sum(0.4 for p in shape.placements if p.is_open)

    return cost


def _transition_cost(prev: Shape, current: Shape) -> float:
    """직전 운지에서 현재 운지로 옮겨가는 손 이동 비용."""
    prev_pos = prev.position
    current_pos = current.position
    if prev_pos is None or current_pos is None:
        return 0.0

    distance = abs(current_pos - prev_pos)
    # 1~2프렛 이동은 거의 공짜, 그 이상부터 실제 손 이동으로 취급한다.
    return max(0.0, distance - 2) * 2.2


def _enumerate_shapes(
    midis: Sequence[int],
    tuning: Sequence[int],
    max_fret: int,
    max_hand_span: int,
) -> List[Tuple[Shape, float]]:
    """한 프레임의 후보 운지들을 비용순으로 반환."""
    unique_midis = sorted(set(midis), reverse=True)
    if not unique_midis:
        return [(Shape(placements=()), 0.0)]

    # 기타는 줄이 6개뿐이라 동시에 6음을 넘을 수 없다. 높은 음 우선으로 자른다.
    unique_midis = unique_midis[: len(tuning)]

    per_note = [candidate_positions(m, tuning, max_fret) for m in unique_midis]
    if any(not options for options in per_note):
        # 지판 밖의 음은 옥타브를 접어 넣는다.
        per_note = []
        for midi in unique_midis:
            options = candidate_positions(midi, tuning, max_fret)
            shifted = midi
            while not options and shifted < max(tuning) + max_fret:
                shifted += 12
                options = candidate_positions(shifted, tuning, max_fret)
            while not options and shifted > min(tuning):
                shifted -= 12
                options = candidate_positions(shifted, tuning, max_fret)
            per_note.append(options)

    per_note = [options for options in per_note if options]
    if not per_note:
        return [(Shape(placements=()), 0.0)]

    scored: List[Tuple[Shape, float]] = []
    for combo in product(*per_note):
        used_strings = {p.string_index for p in combo}
        if len(used_strings) != len(combo):
            continue  # 한 줄에 두 음을 동시에 누를 수 없다.
        shape = Shape(placements=tuple(sorted(combo, key=lambda p: p.string_index)))
        scored.append((shape, _shape_cost(shape, max_hand_span)))

    if not scored:
        # 모든 조합이 줄 충돌이면 높은 음부터 욕심껏 채운다.
        placements: List[Placement] = []
        used: set[int] = set()
        for options in per_note:
            for option in sorted(options, key=lambda p: (p.fret > 12, p.fret)):
                if option.string_index not in used:
                    placements.append(option)
                    used.add(option.string_index)
                    break
        shape = Shape(placements=tuple(sorted(placements, key=lambda p: p.string_index)))
        return [(shape, _shape_cost(shape, max_hand_span))]

    scored.sort(key=lambda item: item[1])
    return scored[:_MAX_SHAPES_PER_FRAME]


def optimize_fingering(
    frames: Iterable[Sequence[int]],
    tuning: Sequence[int] = STANDARD_TUNING_MIDI,
    max_fret: int = 20,
    max_hand_span: int = 5,
) -> List[Shape]:
    """프레임 시퀀스 전체에 대해 손 이동이 최소가 되는 운지를 고른다.

    각 프레임의 후보 shape 를 상태로 두고 비터비로 최단 경로를 찾는다.
    """
    frame_list = [list(frame) for frame in frames]
    if not frame_list:
        return []

    layers = [
        _enumerate_shapes(midis, tuning, max_fret, max_hand_span) for midis in frame_list
    ]

    # 비터비 초기화
    prev_shapes = [shape for shape, _ in layers[0]]
    prev_costs = [cost for _, cost in layers[0]]
    backpointers: List[List[int]] = []

    for layer in layers[1:]:
        current_shapes = [shape for shape, _ in layer]
        current_costs: List[float] = []
        current_back: List[int] = []

        for shape, intrinsic in layer:
            best_cost = float("inf")
            best_prev = 0
            for prev_index, prev_shape in enumerate(prev_shapes):
                total = prev_costs[prev_index] + _transition_cost(prev_shape, shape)
                if total < best_cost:
                    best_cost = total
                    best_prev = prev_index
            current_costs.append(best_cost + intrinsic)
            current_back.append(best_prev)

        backpointers.append(current_back)
        prev_shapes = current_shapes
        prev_costs = current_costs

    # 역추적
    best_index = min(range(len(prev_costs)), key=lambda i: prev_costs[i])
    path = [best_index]
    for back in reversed(backpointers):
        best_index = back[best_index]
        path.append(best_index)
    path.reverse()

    return [layers[layer_index][state_index][0] for layer_index, state_index in enumerate(path)]


def shape_to_frets(shape: Shape, string_count: int = 6) -> List[Optional[int]]:
    """Shape 를 줄별 프렛 배열로. 누르지 않는 줄은 None."""
    frets: List[Optional[int]] = [None] * string_count
    for placement in shape.placements:
        if 0 <= placement.string_index < string_count:
            frets[placement.string_index] = placement.fret
    return frets


def detect_techniques(previous: Optional[Shape], current: Shape) -> List[str]:
    """운지 변화에서 연주 기법을 추정한다."""
    techniques: List[str] = []
    fretted = current.fretted

    if len(current.placements) >= 5 and fretted and len(set(fretted)) < len(fretted):
        techniques.append("barre")
    if fretted and min(fretted) >= 12:
        techniques.append("high_position")
    if len(current.placements) >= 3:
        techniques.append("chord")
    elif len(current.placements) == 1:
        techniques.append("single_note")

    if previous is not None:
        prev_pos, current_pos = previous.position, current.position
        if prev_pos is not None and current_pos is not None:
            delta = current_pos - prev_pos
            if 0 < abs(delta) <= 2 and len(previous.placements) == len(current.placements) == 1:
                techniques.append("hammer_on" if delta > 0 else "pull_off")
            elif abs(delta) >= 5:
                techniques.append("position_shift")

    return techniques or ["basic"]


def summarize_difficulty(shapes: Sequence[Shape], tempo: int, notes_per_second: float) -> str:
    """운지 난이도 + 템포 + 음 밀도로 종합 난이도를 매긴다."""
    if not shapes:
        return "초급"

    fretted_shapes = [s for s in shapes if s.fretted]
    avg_span = sum(s.span for s in fretted_shapes) / max(len(fretted_shapes), 1)
    max_position = max((s.position or 0) for s in shapes)
    avg_polyphony = sum(len(s.placements) for s in shapes) / len(shapes)

    score = 0
    if tempo >= 140:
        score += 1
    if notes_per_second >= 4.0:
        score += 1
    if avg_span >= 3.0:
        score += 1
    if max_position >= 9:
        score += 1
    if avg_polyphony >= 3.0:
        score += 1

    if score <= 1:
        return "초급"
    if score <= 3:
        return "중급"
    return "고급"
