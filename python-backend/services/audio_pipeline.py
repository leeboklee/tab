import json
import logging
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yt_dlp

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = (".wav", ".mp3", ".m4a", ".webm", ".ogg", ".opus", ".aac", ".flac")


class AudioExtractionError(RuntimeError):
    def __init__(self, message: str, diagnostics: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.diagnostics = diagnostics or {}


class AudioPipelineService:
    """
    유튜브 음원 추출과 저장을 담당하는 파이프라인.
    - 추출과 분석 단계를 분리해 실패 지점을 명확히 식별한다.
    - 추출 성공 시 원본 오디오를 저장하고 메타데이터를 함께 기록한다.
    """

    def __init__(self, storage_root: Optional[Path] = None):
        backend_root = Path(__file__).resolve().parents[1]
        self.storage_root = storage_root or backend_root / "storage" / "audio"
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self.ffmpeg_path, self.ffmpeg_source = self._resolve_ffmpeg_path()
        self.yt_dlp_version = yt_dlp.version.__version__

    def diagnostics(self) -> Dict[str, Any]:
        return {
            "yt_dlp_version": self.yt_dlp_version,
            "ffmpeg_available": bool(self.ffmpeg_path),
            "ffmpeg_path": self.ffmpeg_path,
            "ffmpeg_source": self.ffmpeg_source,
            "storage_root": str(self.storage_root),
            "cookie_file_configured": bool(self._cookie_file_path()),
        }

    def extract_audio(self, url: str) -> Dict[str, Any]:
        extraction_id = str(uuid.uuid4())
        work_dir = self.storage_root / extraction_id
        work_dir.mkdir(parents=True, exist_ok=True)
        attempts: List[Dict[str, Any]] = []

        attempt_specs = self._attempt_specs(work_dir)
        info: Optional[Dict[str, Any]] = None
        audio_path: Optional[Path] = None

        for spec in attempt_specs:
            start = time.time()
            name = spec["name"]
            opts = spec["opts"]
            try:
                info, audio_path = self._download_audio(url, work_dir, opts)
                attempts.append(
                    {
                        "name": name,
                        "status": "success",
                        "elapsed_sec": round(time.time() - start, 3),
                    }
                )
                break
            except Exception as exc:
                attempts.append(
                    {
                        "name": name,
                        "status": "failed",
                        "elapsed_sec": round(time.time() - start, 3),
                        "error": str(exc),
                    }
                )
                logger.warning("Audio extraction attempt failed (%s): %s", name, exc)

        if not info or not audio_path:
            diagnostics = self.diagnostics()
            diagnostics["attempts"] = attempts
            self._write_failure_record(work_dir, url, diagnostics)
            raise AudioExtractionError("Failed to extract audio from YouTube", diagnostics=diagnostics)

        record = self._build_record(url=url, extraction_id=extraction_id, info=info, audio_path=audio_path, attempts=attempts)
        self._write_record(work_dir, record)
        return record

    def load_record(self, audio_id: str) -> Dict[str, Any]:
        metadata_file = self.storage_root / audio_id / "metadata.json"
        if not metadata_file.exists():
            raise FileNotFoundError(f"Audio metadata not found: {audio_id}")

        with metadata_file.open("r", encoding="utf-8") as fp:
            record = json.load(fp)
        return record

    def _attempt_specs(self, work_dir: Path) -> List[Dict[str, Any]]:
        specs = [
            {
                "name": "default_best_audio",
                "opts": self._build_ydl_opts(work_dir),
            },
            {
                "name": "youtube_mweb_client",
                "opts": self._build_ydl_opts(
                    work_dir,
                    extractor_args={"youtube": {"player_client": ["mweb", "web"]}},
                ),
            },
        ]

        cookie_file = self._cookie_file_path()
        if cookie_file:
            specs.append(
                {
                    "name": "with_cookie_file",
                    "opts": self._build_ydl_opts(work_dir, cookie_file=cookie_file),
                }
            )

        return specs

    def _build_ydl_opts(
        self,
        work_dir: Path,
        extractor_args: Optional[Dict[str, Any]] = None,
        cookie_file: Optional[str] = None,
    ) -> Dict[str, Any]:
        opts: Dict[str, Any] = {
            "format": "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": str(work_dir / "%(id)s.%(ext)s"),
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "retries": 3,
            "fragment_retries": 3,
            "socket_timeout": 30,
            "skip_download": False,
        }

        if extractor_args:
            opts["extractor_args"] = extractor_args
        if cookie_file:
            opts["cookiefile"] = cookie_file
        if self.ffmpeg_path:
            opts["ffmpeg_location"] = self.ffmpeg_path
            opts["prefer_ffmpeg"] = True
            opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "0",
                }
            ]

        return opts

    def _download_audio(
        self, url: str, work_dir: Path, ydl_opts: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Path]:
        before_files = {p.name for p in work_dir.iterdir() if p.is_file()}

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

        normalized_info = info if isinstance(info, dict) else {}
        audio_path = self._resolve_audio_path(normalized_info, work_dir, before_files)
        if not audio_path:
            raise RuntimeError("Downloaded file not found")

        return normalized_info, audio_path

    def _resolve_audio_path(
        self, info: Dict[str, Any], work_dir: Path, before_files: set[str]
    ) -> Optional[Path]:
        requested = info.get("requested_downloads", [])
        for item in requested:
            filepath = item.get("filepath")
            if filepath:
                path = Path(filepath)
                if path.exists() and path.suffix.lower() in AUDIO_EXTENSIONS:
                    return path

        maybe_filename = info.get("_filename")
        if maybe_filename:
            path = Path(maybe_filename)
            if path.exists() and path.suffix.lower() in AUDIO_EXTENSIONS:
                return path

        candidates = []
        for file in work_dir.iterdir():
            if not file.is_file() or file.name in before_files:
                continue
            if file.suffix.lower() in AUDIO_EXTENSIONS:
                candidates.append(file)

        if not candidates:
            # 일부 환경에서 부분 파일이 남는 경우도 있으므로 전체 스캔
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
        video_id = info.get("id") or audio_path.stem
        return {
            "audio_id": extraction_id,
            "source_url": url,
            "source_video_id": video_id,
            "title": info.get("title", "Unknown Title"),
            "artist": info.get("uploader", "Unknown Artist"),
            "duration": int(info.get("duration") or 0),
            "thumbnail": info.get("thumbnail", ""),
            "upload_date": info.get("upload_date", ""),
            "view_count": int(info.get("view_count") or 0),
            "audio_path": str(audio_path.resolve()),
            "audio_ext": audio_path.suffix.lower().replace(".", ""),
            "audio_size_bytes": audio_path.stat().st_size if audio_path.exists() else 0,
            "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "attempts": attempts,
            "diagnostics": self.diagnostics(),
        }

    def _write_record(self, work_dir: Path, record: Dict[str, Any]) -> None:
        metadata_path = work_dir / "metadata.json"
        with metadata_path.open("w", encoding="utf-8") as fp:
            json.dump(record, fp, ensure_ascii=False, indent=2)

    def _write_failure_record(self, work_dir: Path, url: str, diagnostics: Dict[str, Any]) -> None:
        metadata_path = work_dir / "metadata.json"
        payload = {
            "audio_id": work_dir.name,
            "source_url": url,
            "status": "failed",
            "diagnostics": diagnostics,
            "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        with metadata_path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)

    @staticmethod
    def _cookie_file_path() -> Optional[str]:
        cookie_file = os.getenv("YTDLP_COOKIE_FILE", "").strip()
        if cookie_file and Path(cookie_file).exists():
            return cookie_file
        return None

    @staticmethod
    def _resolve_ffmpeg_path() -> Tuple[Optional[str], str]:
        direct = shutil.which("ffmpeg")
        if direct:
            return direct, "system_path"

        try:
            import imageio_ffmpeg

            imageio_path = imageio_ffmpeg.get_ffmpeg_exe()
            if imageio_path and Path(imageio_path).exists():
                return imageio_path, "imageio_ffmpeg"
        except Exception:
            pass

        return None, "not_found"
