"""Demucs 기반 음원 분리.

반주 전체를 그대로 채보하면 드럼/보컬/베이스가 전부 섞여 들어와
기타 타브가 망가진다. 채보 전에 기타 스템만 뽑아내면 정확도가 크게 오른다.

htdemucs_6s 모델은 guitar / piano 스템을 따로 내주므로 이를 1순위로 쓰고,
없으면 `other` 스템으로 폴백한다. Demucs 미설치 시에는 원본을 그대로 쓴다.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# 6-스템 모델에서 우선적으로 찾는 순서.
_STEM_PREFERENCE = ("guitar", "other")


def separation_status(model: str, device_override: str = "") -> Dict[str, Any]:
    """Demucs 사용 가능 여부와 실행 디바이스를 보고한다."""
    try:
        import demucs  # noqa: F401
    except Exception as exc:
        return {
            "demucs_available": False,
            "torch_available": False,
            "cuda_available": False,
            "device": "unavailable",
            "model": model,
            "error": str(exc),
        }

    try:
        import torch

        cuda = bool(torch.cuda.is_available())
        return {
            "demucs_available": True,
            "torch_available": True,
            "cuda_available": cuda,
            "device": device_override or ("cuda" if cuda else "cpu"),
            "model": model,
        }
    except Exception as exc:
        return {
            "demucs_available": True,
            "torch_available": False,
            "cuda_available": False,
            "device": device_override or "cpu",
            "model": model,
            "error": str(exc),
        }


def _trim_to_wav(audio_path: str, target: Path, max_seconds: int, ffmpeg_path: str) -> None:
    """Demucs 는 느리므로 분석 구간만 잘라 44.1kHz 스테레오 wav 로 만든다."""
    cmd = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        audio_path,
        "-t",
        str(max_seconds),
        "-ar",
        "44100",
        "-ac",
        "2",
        str(target),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def separate_guitar_stem(
    audio_path: str,
    model: str = "htdemucs_6s",
    device: str = "",
    segment: str = "10",
    timeout_sec: int = 900,
    max_seconds: int = 120,
    ffmpeg_path: Optional[str] = None,
) -> Tuple[Optional[str], Dict[str, Any]]:
    """기타 스템 wav 경로와 진단 정보를 반환한다. 실패 시 (None, 진단)."""
    status = separation_status(model, device)
    if not status.get("demucs_available"):
        return None, {
            "separation_status": "unavailable",
            "reason": "demucs_not_installed",
            "detail": status.get("error", ""),
        }

    ffmpeg = ffmpeg_path or shutil.which("ffmpeg")
    if not ffmpeg:
        return None, {"separation_status": "unavailable", "reason": "ffmpeg_not_found"}

    resolved_device = device or str(status.get("device") or "cpu")

    try:
        with tempfile.TemporaryDirectory(prefix="g2t-demucs-") as temp_dir:
            temp_path = Path(temp_dir)
            clip_path = temp_path / "input.wav"
            out_dir = temp_path / "separated"

            _trim_to_wav(audio_path, clip_path, max_seconds, ffmpeg)

            cmd = [
                sys.executable,
                "-m",
                "demucs.separate",
                "-n", model,
                "--device", resolved_device,
                "--jobs", "0",
                "--shifts", "1",
                "--segment", segment,
                "--out", str(out_dir),
                str(clip_path),
            ]
            subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=timeout_sec)

            for stem_name in _STEM_PREFERENCE:
                matches = sorted(out_dir.glob(f"*/input/{stem_name}.wav"))
                if matches:
                    final_path = Path(audio_path).with_name(f"{Path(audio_path).stem}.{stem_name}-stem.wav")
                    final_path.write_bytes(matches[0].read_bytes())
                    return str(final_path), {
                        "separation_status": "ok",
                        "stem": stem_name,
                        "stem_path": str(final_path),
                        "model": model,
                        "device": resolved_device,
                        "duration_limit_sec": max_seconds,
                    }

            return None, {
                "separation_status": "failed",
                "reason": "stem_file_not_found",
                "model": model,
                "device": resolved_device,
            }
    except subprocess.TimeoutExpired as exc:
        return None, {"separation_status": "failed", "reason": "demucs_timeout", "detail": str(exc)}
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or "").strip()[-500:]
        return None, {"separation_status": "failed", "reason": "demucs_process_error", "detail": detail}
    except Exception as exc:
        logger.warning("Demucs separation failed: %s", exc)
        return None, {"separation_status": "failed", "reason": "demucs_error", "detail": str(exc)}
