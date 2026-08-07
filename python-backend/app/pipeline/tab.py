"""노트 이벤트 -> 마디 단위 타브 악보.

비트 그리드에 노트를 양자화하고, 동시에 울리는 음을 묶어 프레임으로 만든 뒤
지판 최적화(fretboard.optimize_fingering)를 거쳐 마디로 조립한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .fretboard import (
    STANDARD_TUNING_MIDI,
    STRING_NAMES,
    Shape,
    detect_techniques,
    midi_to_note_name,
    optimize_fingering,
    shape_to_frets,
    summarize_difficulty,
)
from .transcription import NoteEvent

# 한 마디를 몇 칸으로 쪼갤지(16분음표 기준).
DEFAULT_SUBDIVISIONS = 8
BEATS_PER_MEASURE = 4


@dataclass
class TabResult:
    measures: List[Dict[str, Any]] = field(default_factory=list)
    difficulty: str = "초급"
    techniques: List[str] = field(default_factory=list)
    diagnostics: Dict[str, Any] = field(default_factory=dict)


def build_grid(
    beat_times: Sequence[float],
    duration: float,
    tempo: int,
    subdivisions: int = DEFAULT_SUBDIVISIONS,
) -> List[float]:
    """양자화 격자를 만든다. 비트 정보가 있으면 그것을 세분화한다."""
    if len(beat_times) >= 2:
        grid: List[float] = []
        for index in range(len(beat_times) - 1):
            start, end = float(beat_times[index]), float(beat_times[index + 1])
            step = (end - start) / max(1, subdivisions // BEATS_PER_MEASURE * 2 or 2)
            position = start
            while position < end - 1e-6:
                grid.append(position)
                position += step
        grid.append(float(beat_times[-1]))
        return grid

    # 비트 추적이 실패하면 템포로 균등 격자를 만든다.
    step = (60.0 / max(tempo, 40)) / 2
    count = max(1, int(duration / step))
    return [index * step for index in range(count + 1)]


def quantize_notes(notes: Sequence[NoteEvent], grid: Sequence[float]) -> List[List[int]]:
    """격자 칸마다 울리고 있는 음(MIDI)들의 목록을 만든다."""
    if not grid:
        return []

    frames: List[List[int]] = [[] for _ in range(len(grid))]
    for note in notes:
        # 노트가 걸쳐 있는 모든 칸이 아니라 '시작하는' 칸에만 배치해
        # 지속음이 매 칸마다 다시 튕기는 것처럼 보이지 않게 한다.
        slot = _nearest_slot(grid, note.start)
        if slot is None:
            continue
        if note.midi not in frames[slot]:
            frames[slot].append(note.midi)

    return frames


def _nearest_slot(grid: Sequence[float], time: float) -> Optional[int]:
    if not grid:
        return None
    best_index, best_distance = 0, abs(grid[0] - time)
    for index in range(1, len(grid)):
        distance = abs(grid[index] - time)
        if distance < best_distance:
            best_index, best_distance = index, distance
        elif grid[index] > time:
            break
    return best_index


def build_tab(
    notes: Sequence[NoteEvent],
    beat_times: Sequence[float],
    tempo: int,
    duration: float,
    max_fret: int = 20,
    max_hand_span: int = 5,
    max_measures: int = 64,
    tuning: Sequence[int] = STANDARD_TUNING_MIDI,
) -> TabResult:
    """노트 이벤트로부터 마디 배열을 만든다."""
    if not notes:
        return TabResult(
            diagnostics={"tab_status": "empty", "reason": "no_note_events"}
        )

    grid = build_grid(beat_times, duration, tempo)
    frames = quantize_notes(notes, grid)

    # 소리가 나는 칸만 골라 최적화한다(빈 칸까지 넣으면 DP 상태가 낭비된다).
    active_indices = [index for index, midis in enumerate(frames) if midis]
    if not active_indices:
        return TabResult(diagnostics={"tab_status": "empty", "reason": "no_active_frames"})

    shapes = optimize_fingering(
        (frames[index] for index in active_indices),
        tuning=tuning,
        max_fret=max_fret,
        max_hand_span=max_hand_span,
    )

    shape_by_index: Dict[int, Shape] = dict(zip(active_indices, shapes))

    # 격자 칸 -> 마디로 묶는다.
    slots_per_measure = max(1, DEFAULT_SUBDIVISIONS)
    measures: List[Dict[str, Any]] = []
    all_techniques: set[str] = set()
    previous_shape: Optional[Shape] = None

    for measure_index in range(0, len(grid), slots_per_measure):
        if len(measures) >= max_measures:
            break

        slot_indices = list(range(measure_index, min(measure_index + slots_per_measure, len(grid))))
        if not slot_indices:
            break

        beats: List[Dict[str, Any]] = []
        for slot_index in slot_indices:
            shape = shape_by_index.get(slot_index)
            if shape is None:
                continue
            techniques = detect_techniques(previous_shape, shape)
            all_techniques.update(techniques)
            previous_shape = shape

            frets = shape_to_frets(shape, len(tuning))
            beats.append(
                {
                    "time": round(float(grid[slot_index]), 3),
                    "frets": [fret if fret is not None else None for fret in frets],
                    "midi": [placement.midi for placement in shape.placements],
                    "note_names": [midi_to_note_name(placement.midi) for placement in shape.placements],
                    "techniques": techniques,
                }
            )

        if not beats:
            continue

        start_time = float(grid[slot_indices[0]])
        end_index = min(slot_indices[-1] + 1, len(grid) - 1)
        end_time = float(grid[end_index])

        measures.append(
            {
                "measure": len(measures) + 1,
                # 하위 호환: 마디 대표 운지를 6칸 배열로 유지한다(미표시는 0).
                "frets": _representative_frets(beats, len(tuning)),
                "notes": list(STRING_NAMES[: len(tuning)]),
                "technique": beats[0]["techniques"][0] if beats[0]["techniques"] else "basic",
                "start_time": round(start_time, 2),
                "duration": round(max(end_time - start_time, 0.1), 2),
                "beats": beats,
            }
        )

    notes_per_second = len(notes) / max(duration, 1.0)
    difficulty = summarize_difficulty(shapes, tempo, notes_per_second)

    return TabResult(
        measures=measures,
        difficulty=difficulty,
        techniques=sorted(all_techniques),
        diagnostics={
            "tab_status": "ok" if measures else "empty",
            "grid_slots": len(grid),
            "active_slots": len(active_indices),
            "measure_count": len(measures),
            "notes_per_second": round(notes_per_second, 2),
        },
    )


def _representative_frets(beats: List[Dict[str, Any]], string_count: int) -> List[int]:
    """마디를 대표하는 운지 하나. 가장 음이 많은 칸을 고른다."""
    if not beats:
        return [0] * string_count
    richest = max(beats, key=lambda beat: len([f for f in beat["frets"] if f is not None]))
    return [fret if fret is not None else 0 for fret in richest["frets"]]


def render_ascii(measures: Sequence[Dict[str, Any]], per_line: int = 4) -> str:
    """사람이 읽는 ASCII 타브. 텍스트 내보내기와 디버깅용."""
    if not measures:
        return ""

    lines: List[str] = []
    for chunk_start in range(0, len(measures), per_line):
        chunk = measures[chunk_start : chunk_start + per_line]
        rows = [f"{name}|" for name in STRING_NAMES]

        for measure in chunk:
            for beat in measure.get("beats", []):
                frets = beat.get("frets", [])
                width = max((len(str(f)) for f in frets if f is not None), default=1)
                for string_index in range(len(STRING_NAMES)):
                    fret = frets[string_index] if string_index < len(frets) else None
                    cell = str(fret) if fret is not None else "-"
                    rows[string_index] += f"-{cell:->{width}}"
            for string_index in range(len(STRING_NAMES)):
                rows[string_index] += "-|"

        lines.extend(rows)
        lines.append("")

    return "\n".join(lines).rstrip()
