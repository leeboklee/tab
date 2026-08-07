"""분석 파이프라인 오케스트레이터.

  추출(yt-dlp) -> 분리(Demucs) -> 채보(Basic Pitch) -> 특징(librosa)
  -> 지판 최적화(DP) -> 마디 조립 -> 내보내기

각 단계는 독립적으로 실패할 수 있고, 실패해도 다음 단계가 가능한 만큼
진행하도록 설계했다. 어떤 단계가 어떤 이유로 빠졌는지는 응답의
`pipeline_diagnostics` 에 전부 남는다.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import Settings
from . import export, features, separation, tab, transcription
from .youtube import YouTubeExtractor

logger = logging.getLogger(__name__)

QUALITY_FAST = "fast"        # 분리 없이 원본 그대로 채보
QUALITY_BALANCED = "balanced"  # 기본값. 분리는 가능하면 수행
QUALITY_HIGH = "high"        # 분리 필수 + 임계값을 낮춰 더 많은 음을 잡음

# 기존 프론트엔드가 보내던 값과의 호환.
_QUALITY_ALIASES = {
    "local_quality": QUALITY_HIGH,
    "cloud": QUALITY_BALANCED,
}


def normalize_quality(raw: str) -> str:
    value = (raw or "").strip().lower()
    value = _QUALITY_ALIASES.get(value, value)
    return value if value in {QUALITY_FAST, QUALITY_BALANCED, QUALITY_HIGH} else QUALITY_BALANCED


class Analyzer:
    def __init__(self, settings: Settings, extractor: YouTubeExtractor):
        self.settings = settings
        self.extractor = extractor

    # ------------------------------------------------------------------ 상태

    def capabilities(self) -> Dict[str, Any]:
        """어떤 엔진이 실제로 살아있는지 보고한다."""
        deps = {"librosa": False, "numpy": False, "soundfile": False}
        for name in list(deps):
            try:
                __import__(name)
                deps[name] = True
            except Exception:
                pass

        return {
            "audio_analysis_deps": deps,
            "transcription": {
                "basic_pitch_available": transcription.basic_pitch_available(),
                "engine": "basic_pitch" if transcription.basic_pitch_available() else "librosa_cqt",
            },
            "high_quality": separation.separation_status(
                self.settings.demucs_model, self.settings.demucs_device
            ),
            "export_formats": export.available_formats(),
            "cloud_analysis": {
                "configured": self.settings.cloud_configured(),
                "api_key_configured": bool(self.settings.cloud_api_key),
            },
        }

    # ------------------------------------------------------------------ 실행

    def analyze_record(self, record: Dict[str, Any], quality: str = QUALITY_BALANCED) -> Dict[str, Any]:
        """저장된 음원 레코드를 분석해 최종 응답 페이로드를 만든다."""
        audio_path = record.get("audio_path")
        if not audio_path or not Path(audio_path).exists():
            raise FileNotFoundError("Saved audio file is missing")

        quality = normalize_quality(quality)
        diagnostics: Dict[str, Any] = {"quality": quality}

        # 1) 스템 분리
        source_path, separation_diag = self._separate(audio_path, quality)
        diagnostics.update(separation_diag)

        # 2) 파형 로드
        y, sr, load_diag = self._load_waveform(source_path)
        diagnostics.update(load_diag)

        # 3) 곡 특징
        audio_features = features.extract_features(y, sr) if y is not None else features.AudioFeatures()
        diagnostics.update(audio_features.diagnostics)

        # 4) 다성 채보
        thresholds = self._thresholds(quality)
        transcript = transcription.transcribe(
            source_path,
            y=y,
            sr=sr,
            onset_threshold=thresholds["onset"],
            frame_threshold=thresholds["frame"],
            minimum_note_length_ms=self.settings.minimum_note_length_ms,
        )
        diagnostics.update(transcript.diagnostics)

        # 5) 지판 최적화 + 마디 조립
        duration = audio_features.duration or float(record.get("duration") or 0)
        tab_result = tab.build_tab(
            transcript.notes,
            beat_times=audio_features.beat_times,
            tempo=audio_features.tempo,
            duration=duration,
            max_fret=self.settings.max_fret,
            max_hand_span=self.settings.max_hand_span,
        )
        diagnostics.update(tab_result.diagnostics)

        # 6) 내보내기
        export_paths = self._export(record, transcript.notes, audio_features, tab_result)
        diagnostics["exports"] = {name: bool(path) for name, path in export_paths.items()}

        return self._build_payload(record, audio_features, transcript, tab_result, export_paths, diagnostics)

    def analyze_url(self, url: str, quality: str = QUALITY_BALANCED) -> Dict[str, Any]:
        record = self.extractor.extract(url)
        return self.analyze_record(record, quality)

    # ------------------------------------------------------------------ 단계별

    def _thresholds(self, quality: str) -> Dict[str, float]:
        if quality == QUALITY_HIGH:
            # 임계값을 낮추면 약하게 울리는 음까지 잡는다.
            return {"onset": max(0.2, self.settings.onset_threshold - 0.15), "frame": max(0.1, self.settings.frame_threshold - 0.1)}
        if quality == QUALITY_FAST:
            return {"onset": min(0.9, self.settings.onset_threshold + 0.1), "frame": min(0.9, self.settings.frame_threshold + 0.1)}
        return {"onset": self.settings.onset_threshold, "frame": self.settings.frame_threshold}

    def _separate(self, audio_path: str, quality: str) -> Tuple[str, Dict[str, Any]]:
        if quality == QUALITY_FAST or not self.settings.enable_separation:
            return audio_path, {"separation_status": "skipped", "reason": "quality_or_config"}

        stem_path, diag = separation.separate_guitar_stem(
            audio_path,
            model=self.settings.demucs_model,
            device=self.settings.demucs_device,
            segment=self.settings.demucs_segment,
            timeout_sec=self.settings.demucs_timeout_sec,
            max_seconds=self.settings.analysis_max_seconds,
            ffmpeg_path=self.extractor.ffmpeg_path,
        )
        return (stem_path or audio_path), diag

    def _load_waveform(self, path: str) -> Tuple[Any, int, Dict[str, Any]]:
        try:
            import librosa
        except Exception as exc:
            return None, self.settings.analysis_sample_rate, {
                "waveform_status": "unavailable",
                "reason": "librosa_not_installed",
                "detail": str(exc),
            }

        try:
            y, sr = librosa.load(
                path,
                sr=self.settings.analysis_sample_rate,
                mono=True,
                duration=self.settings.analysis_max_seconds,
            )
            if y is None or len(y) == 0:
                raise RuntimeError("empty audio signal")
            return y, int(sr), {"waveform_status": "ok", "sample_rate": int(sr), "samples": int(len(y))}
        except Exception as exc:
            logger.warning("Waveform load failed: %s", exc)
            return None, self.settings.analysis_sample_rate, {
                "waveform_status": "failed",
                "reason": "decode_error",
                "detail": str(exc),
            }

    def _export(
        self,
        record: Dict[str, Any],
        notes: List[transcription.NoteEvent],
        audio_features: features.AudioFeatures,
        tab_result: tab.TabResult,
    ) -> Dict[str, Optional[str]]:
        if not notes:
            return {"midi": None, "musicxml": None}

        audio_path = Path(record.get("audio_path", ""))
        if not audio_path.parent.exists():
            return {"midi": None, "musicxml": None}

        stem = audio_path.stem
        return {
            "midi": export.notes_to_midi(notes, audio_features.tempo, str(audio_path.parent / f"{stem}.mid")),
            "musicxml": export.notes_to_musicxml(
                notes, audio_features.tempo, audio_features.key, str(audio_path.parent / f"{stem}.musicxml")
            ),
        }

    # ------------------------------------------------------------------ 응답 조립

    def _build_payload(
        self,
        record: Dict[str, Any],
        audio_features: features.AudioFeatures,
        transcript: transcription.TranscriptionResult,
        tab_result: tab.TabResult,
        export_paths: Dict[str, Optional[str]],
        diagnostics: Dict[str, Any],
    ) -> Dict[str, Any]:
        transcribed = bool(transcript.notes)
        has_tab = bool(tab_result.measures)

        if has_tab:
            status_summary = "실제 오디오 분석 완료"
            result_mode = "audio_verified"
        elif transcribed:
            status_summary = "채보는 되었으나 타브 조립에 실패"
            result_mode = "partial"
        else:
            status_summary = "오디오 분석 실패 - 메타데이터만 반환"
            result_mode = "metadata_only"

        return {
            "title": record.get("title", "Unknown Title"),
            "artist": record.get("artist", "Unknown Artist"),
            "duration": int(round(audio_features.duration or record.get("duration") or 0)),
            "tempo": audio_features.tempo,
            "key": audio_features.key,
            "difficulty": tab_result.difficulty,
            "tabs": tab_result.measures,
            "chord_progressions": audio_features.chords,
            "techniques": tab_result.techniques,
            "ascii_tab": tab.render_ascii(tab_result.measures),
            "note_count": len(transcript.notes),
            "metadata": {
                "view_count": record.get("view_count", 0),
                "upload_date": record.get("upload_date", ""),
                "thumbnail": record.get("thumbnail", ""),
                "video_id": record.get("source_video_id", ""),
                "audio_id": record.get("audio_id", ""),
                "audio_ext": record.get("audio_ext", ""),
                "audio_size_bytes": record.get("audio_size_bytes", 0),
                "audio_path": record.get("audio_path", ""),
                "analysis_method": diagnostics.get("engine", "unknown"),
                "result_mode": result_mode,
                "status_summary": status_summary,
                "exports": export_paths,
                "pipeline_status": {
                    "youtube_extraction": "ok",
                    "stem_separation": diagnostics.get("separation_status", "unknown"),
                    "transcription": diagnostics.get("transcription_status", "unknown"),
                    "feature_extraction": diagnostics.get("feature_status", "unknown"),
                    "tab_generation": diagnostics.get("tab_status", "unknown"),
                },
                "pipeline_diagnostics": {
                    "extract_attempts": record.get("attempts", []),
                    "analysis": diagnostics,
                },
            },
        }
