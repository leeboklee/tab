"""런타임 설정. 모든 값은 환경변수로 덮어쓸 수 있다."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_list(name: str, default: List[str]) -> List[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Settings:
    # --- 서버 ---
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _env_int("PORT", 8002))
    cors_origins: List[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            [
                "http://localhost:3019",
                "http://127.0.0.1:3019",
                "http://localhost:3000",
                "http://localhost:5958",
            ],
        )
    )

    # --- 저장소 ---
    storage_root: Path = field(
        default_factory=lambda: Path(os.getenv("STORAGE_ROOT", "").strip() or BACKEND_ROOT / "storage" / "audio")
    )

    # --- 분석 구간 ---
    analysis_sample_rate: int = field(default_factory=lambda: _env_int("ANALYSIS_SAMPLE_RATE", 22050))
    analysis_max_seconds: int = field(default_factory=lambda: _env_int("ANALYSIS_MAX_SECONDS", 120))

    # --- Demucs (스템 분리) ---
    demucs_model: str = field(default_factory=lambda: os.getenv("DEMUCS_MODEL", "htdemucs_6s"))
    demucs_device: str = field(default_factory=lambda: os.getenv("DEMUCS_DEVICE", "").strip())
    demucs_segment: str = field(default_factory=lambda: os.getenv("DEMUCS_SEGMENT", "10"))
    demucs_timeout_sec: int = field(default_factory=lambda: _env_int("DEMUCS_TIMEOUT_SEC", 900))

    # --- Basic Pitch (다성 채보) ---
    onset_threshold: float = field(default_factory=lambda: _env_float("BASIC_PITCH_ONSET_THRESHOLD", 0.5))
    frame_threshold: float = field(default_factory=lambda: _env_float("BASIC_PITCH_FRAME_THRESHOLD", 0.3))
    minimum_note_length_ms: float = field(default_factory=lambda: _env_float("BASIC_PITCH_MIN_NOTE_MS", 90.0))

    # --- 기타 지판 ---
    max_fret: int = field(default_factory=lambda: _env_int("MAX_FRET", 20))
    max_hand_span: int = field(default_factory=lambda: _env_int("MAX_HAND_SPAN", 5))

    # --- yt-dlp ---
    ytdlp_cookie_file: str = field(default_factory=lambda: os.getenv("YTDLP_COOKIE_FILE", "").strip())
    ytdlp_cookies_from_browser: str = field(
        default_factory=lambda: os.getenv("YTDLP_COOKIES_FROM_BROWSER", "").strip()
    )

    # --- 원격 위임 분석 ---
    cloud_api_base: str = field(default_factory=lambda: os.getenv("CLOUD_ANALYSIS_API_BASE", "").strip().rstrip("/"))
    cloud_api_key: str = field(default_factory=lambda: os.getenv("CLOUD_ANALYSIS_API_KEY", "").strip())
    cloud_timeout_sec: int = field(default_factory=lambda: _env_int("CLOUD_ANALYSIS_TIMEOUT_SEC", 900))

    # --- 기능 토글 ---
    enable_separation: bool = field(default_factory=lambda: _env_bool("ENABLE_SEPARATION", True))

    def cloud_configured(self) -> bool:
        return bool(self.cloud_api_base)


settings = Settings()
