"""yt-dlp 기반 유튜브 음원 추출.

추출 단계를 분석 단계와 분리해 실패 지점을 명확히 남긴다.
클라이언트 차단에 대비해 여러 전략을 순차 시도하고 시도 내역을 기록한다.
"""

from __future__ import annotations

import json
import logging
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import yt_dlp

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = (".wav", ".mp3", ".m4a", ".webm", ".ogg", ".opus", ".aac", ".flac")


class AudioExtractionError(RuntimeError):
    def __init__(self, message: str, diagnostics: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.diagnostics = diagnostics or {}


class YouTubeExtractor:
    def __init__(
        self,
        storage_root: Path,
        cookie_file: str = "",
        cookies_from_browser: str = "",
    ):
        self.storage_root = Path(storage_root)
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self.cookie_file = cookie_file
        self.cookies_from_browser = cookies_from_browser
        self.ffmpeg_path, self.ffmpeg_source = self._resolve_ffmpeg()
        self.yt_dlp_version = yt_dlp.version.__version__

    # ------------------------------------------------------------------ 진단

    def diagnostics(self) -> Dict[str, Any]:
        return {
            "yt_dlp_version": self.yt_dlp_version,
            "ffmpeg_available": bool(self.ffmpeg_path),
            "ffmpeg_path": self.ffmpeg_path,
            "ffmpeg_source": self.ffmpeg_source,
            "storage_root": str(self.storage_root),
            "cookie_file_configured": bool(self._cookie_file()),
            "cookies_from_browser_configured": bool(self._browser_cookies()),
        }

    # ------------------------------------------------------------------ 공개 API

    def extract(self, url: str) -> Dict[str, Any]:
        extraction_id = str(uuid.uuid4())
        work_dir = self.storage_root / extraction_id
        work_dir.mkdir(parents=True, exist_ok=True)

        attempts: List[Dict[str, Any]] = []
        info: Optional[Dict[str, Any]] = None
        audio_path: Optional[Path] = None

        for spec in self._attempt_specs(work_dir):
            start = time.time()
            try:
                info, audio_path = self._download(url, work_dir, spec["opts"])
                attempts.append(
                    {"name": spec["name"], "status": "success", "elapsed_sec": round(time.time() - start, 3)}
                )
                break
            except Exception as exc:
                attempts.append(
                    {
                        "name": spec["name"],
                        "status": "failed",
                        "elapsed_sec": round(time.time() - start, 3),
                        "error": str(exc)[:500],
                    }
                )
                logger.warning("Extraction attempt failed (%s): %s", spec["name"], exc)

        if not info or not audio_path:
            diagnostics = {**self.diagnostics(), "attempts": attempts}
            self._write_json(work_dir / "metadata.json", {
                "audio_id": extraction_id,
                "source_url": url,
                "status": "failed",
                "diagnostics": diagnostics,
                "extracted_at": _utc_now(),
            })
            raise AudioExtractionError("Failed to extract audio from YouTube", diagnostics=diagnostics)

        record = self._build_record(url, extraction_id, info, audio_path, attempts)
        self._write_json(work_dir / "metadata.json", record)
        return record

    def load_record(self, audio_id: str) -> Dict[str, Any]:
        metadata_file = self.storage_root / audio_id / "metadata.json"
        if not metadata_file.exists():
            raise FileNotFoundError(f"Audio metadata not found: {audio_id}")
        with metadata_file.open("r", encoding="utf-8") as fp:
            return json.load(fp)

    # ------------------------------------------------------------------ 내부

    def _attempt_specs(self, work_dir: Path) -> List[Dict[str, Any]]:
        specs: List[Dict[str, Any]] = [
            {"name": "default_best_audio", "opts": self._ydl_opts(work_dir)},
            {
                "name": "youtube_tv_web_clients",
                "opts": self._ydl_opts(
                    work_dir, extractor_args={"youtube": {"player_client": ["tv", "web", "mweb"]}}
                ),
            },
        ]

        cookie_file = self._cookie_file()
        if cookie_file:
            specs.append({"name": "with_cookie_file", "opts": self._ydl_opts(work_dir, cookie_file=cookie_file)})

        browser_cookies = self._browser_cookies()
        if browser_cookies:
            specs.append(
                {"name": "with_browser_cookies", "opts": self._ydl_opts(work_dir, cookies_from_browser=browser_cookies)}
            )

        return specs

    def _ydl_opts(
        self,
        work_dir: Path,
        extractor_args: Optional[Dict[str, Any]] = None,
        cookie_file: Optional[str] = None,
        cookies_from_browser: Optional[Tuple[str, ...]] = None,
    ) -> Dict[str, Any]:
        opts: Dict[str, Any] = {
            "format": "bestaudio[acodec!=none][vcodec=none]/bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": str(work_dir / "%(id)s.%(ext)s"),
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "retries": 3,
            "fragment_retries": 3,
            "socket_timeout": 30,
            "format_sort": ["hasaud", "acodec", "abr", "asr"],
        }

        if extractor_args:
            opts["extractor_args"] = extractor_args
        if cookie_file:
            opts["cookiefile"] = cookie_file
        if cookies_from_browser:
            opts["cookiesfrombrowser"] = cookies_from_browser
        if self.ffmpeg_path:
            opts["ffmpeg_location"] = self.ffmpeg_path
            opts["prefer_ffmpeg"] = True
            # 채보 정확도를 위해 무손실 wav 로 통일한다.
            opts["postprocessors"] = [
                {"key": "FFmpegExtractAudio", "preferredcodec": "wav", "preferredquality": "0"}
            ]

        return opts

    def _download(self, url: str, work_dir: Path, opts: Dict[str, Any]) -> Tuple[Dict[str, Any], Path]:
        before = {p.name for p in work_dir.iterdir() if p.is_file()}
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

        normalized = info if isinstance(info, dict) else {}
        audio_path = self._resolve_audio_path(normalized, work_dir, before)
        if not audio_path:
            raise RuntimeError("Downloaded audio file not found")
        return normalized, audio_path

    def _resolve_audio_path(
        self, info: Dict[str, Any], work_dir: Path, before: Set[str]
    ) -> Optional[Path]:
        for item in info.get("requested_downloads", []) or []:
            filepath = item.get("filepath")
            if filepath:
                path = Path(filepath)
                if path.exists() and path.suffix.lower() in AUDIO_EXTENSIONS:
                    return path

        filename = info.get("_filename")
        if filename:
            path = Path(filename)
            if path.exists() and path.suffix.lower() in AUDIO_EXTENSIONS:
                return path

        candidates = [
            f for f in work_dir.iterdir()
            if f.is_file() and f.name not in before and f.suffix.lower() in AUDIO_EXTENSIONS
        ]
        if not candidates:
            candidates = [f for f in work_dir.iterdir() if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS]
        if not candidates:
            return None
        return sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)[0]

    def _build_record(
        self,
        url: str,
        extraction_id: str,
        info: Dict[str, Any],
        audio_path: Path,
        attempts: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return {
            "audio_id": extraction_id,
            "source_url": url,
            "source_video_id": info.get("id") or audio_path.stem,
            "title": info.get("title", "Unknown Title"),
            "artist": info.get("uploader", "Unknown Artist"),
            "duration": int(info.get("duration") or 0),
            "thumbnail": info.get("thumbnail", ""),
            "upload_date": info.get("upload_date", ""),
            "view_count": int(info.get("view_count") or 0),
            "audio_path": str(audio_path.resolve()),
            "audio_ext": audio_path.suffix.lower().lstrip("."),
            "audio_size_bytes": audio_path.stat().st_size if audio_path.exists() else 0,
            "extracted_at": _utc_now(),
            "attempts": attempts,
            "diagnostics": self.diagnostics(),
        }

    @staticmethod
    def _write_json(path: Path, payload: Dict[str, Any]) -> None:
        with path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)

    def _cookie_file(self) -> Optional[str]:
        if self.cookie_file and Path(self.cookie_file).exists():
            return self.cookie_file
        return None

    def _browser_cookies(self) -> Optional[Tuple[str, ...]]:
        if not self.cookies_from_browser:
            return None
        parts = tuple(part.strip() for part in self.cookies_from_browser.split(":") if part.strip())
        return parts or None

    def _resolve_ffmpeg(self) -> Tuple[Optional[str], str]:
        direct = shutil.which("ffmpeg")
        if direct:
            return direct, "system_path"

        try:
            import imageio_ffmpeg

            path = imageio_ffmpeg.get_ffmpeg_exe()
            if path and Path(path).exists():
                return path, "imageio_ffmpeg"
        except Exception:
            pass

        return None, "not_found"


def _utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
