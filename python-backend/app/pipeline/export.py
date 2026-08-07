"""분석 결과 내보내기: MIDI / MusicXML / ASCII 타브.

pretty_midi, music21 은 선택 의존성이다. 없으면 해당 형식만 조용히 건너뛴다.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from .fretboard import STANDARD_TUNING_MIDI
from .transcription import NoteEvent

logger = logging.getLogger(__name__)

# General MIDI: 25 = Acoustic Guitar (steel)
_GUITAR_PROGRAM = 25


def notes_to_midi(notes: Sequence[NoteEvent], tempo: int, out_path: str) -> Optional[str]:
    """노트 이벤트를 MIDI 파일로 저장한다."""
    try:
        import pretty_midi
    except Exception as exc:
        logger.info("MIDI export skipped: %s", exc)
        return None

    try:
        midi = pretty_midi.PrettyMIDI(initial_tempo=float(max(tempo, 40)))
        instrument = pretty_midi.Instrument(program=_GUITAR_PROGRAM - 1, name="Guitar")

        for note in notes:
            end = note.end if note.end > note.start else note.start + 0.12
            instrument.notes.append(
                pretty_midi.Note(
                    velocity=int(max(30, min(127, round(note.confidence * 127)))),
                    pitch=int(note.midi),
                    start=float(note.start),
                    end=float(end),
                )
            )

        if not instrument.notes:
            return None

        midi.instruments.append(instrument)
        midi.write(out_path)
        return out_path
    except Exception as exc:
        logger.warning("MIDI export failed: %s", exc)
        return None


def notes_to_musicxml(
    notes: Sequence[NoteEvent],
    tempo: int,
    key: str,
    out_path: str,
    tuning: Sequence[int] = STANDARD_TUNING_MIDI,
) -> Optional[str]:
    """music21 로 MusicXML 을 만든다. 악보 편집기에서 열 수 있다."""
    try:
        from music21 import chord as m21chord
        from music21 import instrument as m21instrument
        from music21 import key as m21key
        from music21 import note as m21note
        from music21 import stream, tempo as m21tempo
    except Exception as exc:
        logger.info("MusicXML export skipped: %s", exc)
        return None

    try:
        part = stream.Part()
        part.insert(0, m21instrument.AcousticGuitar())
        part.insert(0, m21tempo.MetronomeMark(number=int(max(tempo, 40))))
        try:
            part.insert(0, m21key.Key(key.replace("m", "").strip() or "C"))
        except Exception:
            pass

        # 같은 시점에 시작하는 음을 화음으로 묶는다.
        grouped: Dict[float, List[NoteEvent]] = {}
        for note in notes:
            bucket = round(note.start * 8) / 8  # 32분음표 해상도
            grouped.setdefault(bucket, []).append(note)

        beat_seconds = 60.0 / max(tempo, 40)
        for offset_seconds in sorted(grouped):
            group = grouped[offset_seconds]
            quarter_length = max(0.25, min(4.0, (max(n.duration for n in group)) / beat_seconds))
            offset_quarters = offset_seconds / beat_seconds

            if len(group) == 1:
                element: Any = m21note.Note(group[0].midi)
            else:
                element = m21chord.Chord([n.midi for n in group])
            element.quarterLength = quarter_length
            part.insert(offset_quarters, element)

        if not part.notes:
            return None

        score = stream.Score()
        score.insert(0, part)
        score.write("musicxml", fp=out_path)
        return out_path
    except Exception as exc:
        logger.warning("MusicXML export failed: %s", exc)
        return None


def available_formats() -> Dict[str, bool]:
    """설치 상태에 따라 실제로 내보낼 수 있는 형식을 알려준다."""
    formats = {"json": True, "ascii": True, "midi": False, "musicxml": False}
    try:
        import pretty_midi  # noqa: F401

        formats["midi"] = True
    except Exception:
        pass
    try:
        import music21  # noqa: F401

        formats["musicxml"] = True
    except Exception:
        pass
    return formats
