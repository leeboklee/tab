import json
import logging
import os
import shutil
import socket
import time
import uuid
from importlib import metadata as importlib_metadata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import yt_dlp

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = (".wav", ".mp3", ".m4a", ".webm", ".ogg", ".opus", ".aac", ".flac")

# YouTube bot detection (PO Token) vs network/proxy blocks need different fixes.
_BOT_DETECTION_MARKERS = (
    "sign in to confirm",
    "not a bot",
    "requested format is not available",
    "po_token",
    "potoken",
)
_NETWORK_BLOCK_MARKERS = (
    "unable to connect to proxy",
    "tunnel connection failed",
    "connection refused",
    "name or service not known",
    "network is unreachable",
)


def pot_provider_installed() -> bool:
    """Whether bgutil-ytdlp-pot-provider (or compatible) is installed.

    See https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
    The plugin also needs its HTTP server running (default port 4416).
    """
    try:
        importlib_metadata.version("bgutil-ytdlp-pot-provider")
        return True
    except importlib_metadata.PackageNotFoundError:
        return False


def classify_extraction_failure(attempts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Guess failure category from attempt errors and attach an actionable hint."""
    combined = " ".join(str(a.get("error", "")) for a in attempts).lower()

    if any(marker in combined for marker in _NETWORK_BLOCK_MARKERS):
        return {
            "category": "network_blocked",
            "hint": (
                "이 프로세스에서 youtube.com 으로 나가는 연결 자체가 막혀 있습니다. "
                "샌드박스/방화벽/프록시 정책 문제이므로 코드로 해결할 수 없고, "
                "네트워크 제약이 없는 환경(로컬 PC, 일반 서버)에서 실행해야 합니다."
            ),
        }

    if any(marker in combined for marker in _BOT_DETECTION_MARKERS):
        return {
            "category": "bot_detection",
            "hint": (
                "YouTube가 봇으로 판단해 차단했습니다. "
                "1) 서버에 YTDLP_USE_TOR=true 또는 YTDLP_PROXY 설정 (클라우드/데이터센터 IP) "
                "2) 홈/주거용 IP에서 YTDLP_COOKIE_FILE 또는 YTDLP_COOKIES_FROM_BROWSER "
                "3) bgutil-ytdlp-pot-provider(PO Token) HTTP 서버(:4416) 기동 "
                "4) 그래도 안 되면 음원 파일 업로드(/upload-audio)를 사용하세요."
            ),
        }

    return {
        "category": "unknown",
        "hint": "attempts의 error 메시지를 직접 확인하세요.",
    }


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
        self.backend_root = backend_root
        self.storage_root = storage_root or backend_root / "storage" / "audio"
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self.ffmpeg_path, self.ffmpeg_source = self._resolve_ffmpeg_path()
        self.yt_dlp_version = yt_dlp.version.__version__

    def diagnostics(self) -> Dict[str, Any]:
        proxy = self._effective_proxy()
        return {
            "yt_dlp_version": self.yt_dlp_version,
            "ffmpeg_available": bool(self.ffmpeg_path),
            "ffmpeg_path": self.ffmpeg_path,
            "ffmpeg_source": self.ffmpeg_source,
            "storage_root": str(self.storage_root),
            "cookie_file_configured": bool(self._cookie_file_path()),
            "cookies_from_browser_configured": bool(self._cookies_from_browser()),
            "pot_provider_installed": pot_provider_installed(),
            "proxy_configured": bool(proxy),
            "proxy_url": proxy or "",
            "tor_auto_enabled": self._env_flag("YTDLP_AUTO_TOR", default=True),
            "tor_use_enabled": self._env_flag("YTDLP_USE_TOR", default=False),
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
            failure = classify_extraction_failure(attempts)
            diagnostics = self.diagnostics()
            diagnostics["attempts"] = attempts
            diagnostics["failure"] = failure
            self._write_failure_record(work_dir, url, diagnostics)
            raise AudioExtractionError(
                f"Failed to extract audio from YouTube ({failure['category']}): {failure['hint']}",
                diagnostics=diagnostics,
            )

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

    def ingest_uploaded_audio(
        self,
        *,
        filename: str,
        data: bytes,
        title: Optional[str] = None,
        artist: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Save a user-uploaded audio file as an extractable analysis record.

        Friend-friendly path when YouTube bot detection blocks URL extraction.
        """
        if not data:
            raise ValueError("Uploaded audio is empty")

        suffix = Path(filename or "upload.wav").suffix.lower()
        if suffix not in AUDIO_EXTENSIONS:
            raise ValueError(
                f"Unsupported audio type '{suffix or '(none)'}'. "
                f"Allowed: {', '.join(AUDIO_EXTENSIONS)}"
            )

        max_bytes = self._upload_max_bytes()
        if len(data) > max_bytes:
            raise ValueError(f"Audio file too large (max {max_bytes // (1024 * 1024)}MB)")

        extraction_id = str(uuid.uuid4())
        work_dir = self.storage_root / extraction_id
        work_dir.mkdir(parents=True, exist_ok=True)
        audio_path = work_dir / f"upload{suffix}"
        audio_path.write_bytes(data)

        stem = Path(filename).stem.strip() or "Uploaded Audio"
        record = {
            "audio_id": extraction_id,
            "source_url": f"upload://{filename}",
            "source_video_id": extraction_id,
            "source_type": "upload",
            "title": (title or stem).strip() or "Uploaded Audio",
            "artist": (artist or "Uploaded").strip() or "Uploaded",
            "duration": 0,
            "thumbnail": "",
            "upload_date": "",
            "view_count": 0,
            "audio_path": str(audio_path.resolve()),
            "audio_ext": suffix.replace(".", ""),
            "audio_size_bytes": audio_path.stat().st_size,
            "original_filename": filename,
            "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "attempts": [{"name": "user_upload", "status": "success", "elapsed_sec": 0}],
            "diagnostics": self.diagnostics(),
        }
        self._write_record(work_dir, record)
        return record

    def _attempt_specs(self, work_dir: Path) -> List[Dict[str, Any]]:
        # Community-recommended clients (yt-dlp wiki / 2025-2026 bot guidance):
        # android_vr / tv+web_safari / web_embedded often work without cookies on residential IPs.
        # Datacenter IPs still frequently need Tor proxy or cookies + PO tokens.
        proxy = self._effective_proxy()
        specs: List[Dict[str, Any]] = []

        client_variants: List[Tuple[str, Optional[Dict[str, Any]]]] = [
            ("android_vr", {"youtube": {"player_client": ["android_vr"]}}),
            ("tv_web_safari", {"youtube": {"player_client": ["tv", "web_safari"]}}),
            ("web_embedded", {"youtube": {"player_client": ["web_embedded"]}}),
            ("default_best_audio", None),
            ("ios_android", {"youtube": {"player_client": ["ios", "android"]}}),
        ]

        if proxy:
            # Tor/residential proxy: default client is most reliable (android_vr often needs PO token).
            proxy_order = ["default_best_audio", "tv_web_safari", "web_embedded"]
            proxy_lookup = dict(client_variants)
            for name in proxy_order:
                extractor_args = proxy_lookup.get(name)
                specs.append(
                    {
                        "name": f"proxy_{name}",
                        "opts": self._build_ydl_opts(
                            work_dir,
                            proxy=proxy,
                            extractor_args=extractor_args,
                        ),
                    }
                )

        for name, extractor_args in client_variants:
            specs.append(
                {
                    "name": name,
                    "opts": self._build_ydl_opts(work_dir, extractor_args=extractor_args),
                }
            )

        if pot_provider_installed():
            # Plugin auto-attaches PO tokens when HTTP provider is reachable (:4416).
            specs.append(
                {
                    "name": "mweb_with_pot_provider",
                    "opts": self._build_ydl_opts(
                        work_dir,
                        extractor_args={"youtube": {"player_client": ["mweb"]}},
                    ),
                }
            )
            specs.append(
                {
                    "name": "web_safari_with_pot_provider",
                    "opts": self._build_ydl_opts(
                        work_dir,
                        extractor_args={"youtube": {"player_client": ["web_safari"]}},
                    ),
                }
            )

        cookie_file = self._cookie_file_path()
        if cookie_file:
            # With cookies, avoid web_creator (often needs PO token → 403). See yt-dlp#12085.
            specs.append(
                {
                    "name": "cookie_file_default_minus_web_creator",
                    "opts": self._build_ydl_opts(
                        work_dir,
                        cookie_file=cookie_file,
                        extractor_args={
                            "youtube": {"player_client": ["default", "-web_creator"]}
                        },
                    ),
                }
            )
            specs.append(
                {
                    "name": "cookie_file_web_safari",
                    "opts": self._build_ydl_opts(
                        work_dir,
                        cookie_file=cookie_file,
                        extractor_args={"youtube": {"player_client": ["web_safari"]}},
                    ),
                }
            )

        cookies_from_browser = self._cookies_from_browser()
        if cookies_from_browser:
            specs.append(
                {
                    "name": "browser_cookies_default_minus_web_creator",
                    "opts": self._build_ydl_opts(
                        work_dir,
                        cookies_from_browser=cookies_from_browser,
                        extractor_args={
                            "youtube": {"player_client": ["default", "-web_creator"]}
                        },
                    ),
                }
            )
            specs.append(
                {
                    "name": "browser_cookies_web_safari",
                    "opts": self._build_ydl_opts(
                        work_dir,
                        cookies_from_browser=cookies_from_browser,
                        extractor_args={"youtube": {"player_client": ["web_safari"]}},
                    ),
                }
            )

        return specs

    def _build_ydl_opts(
        self,
        work_dir: Path,
        extractor_args: Optional[Dict[str, Any]] = None,
        cookie_file: Optional[str] = None,
        cookies_from_browser: Optional[Tuple[str, ...]] = None,
        proxy: Optional[str] = None,
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
            "skip_download": False,
            "format_sort": ["hasaud", "acodec", "abr", "asr"],
            # Pace requests slightly — burst patterns look more automated to YouTube.
            "sleep_interval_requests": float(os.getenv("YTDLP_SLEEP_REQUESTS", "0.5") or "0.5"),
        }

        if extractor_args:
            opts["extractor_args"] = extractor_args
        if cookie_file:
            opts["cookiefile"] = cookie_file
        if cookies_from_browser:
            opts["cookiesfrombrowser"] = cookies_from_browser
        if proxy:
            opts["proxy"] = proxy
        js_runtime = self._node_js_runtime()
        if js_runtime:
            opts["js_runtimes"] = {"node": {"path": js_runtime}}
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

    @staticmethod
    def _upload_max_bytes() -> int:
        raw = os.getenv("UPLOAD_AUDIO_MAX_MB", "80").strip()
        try:
            mb = int(raw)
        except ValueError:
            mb = 80
        return max(1, mb) * 1024 * 1024

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
    def _env_flag(name: str, default: bool = False) -> bool:
        raw = os.getenv(name)
        if raw is None or not str(raw).strip():
            return default
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _tor_socks_url() -> str:
        return os.getenv("YTDLP_TOR_SOCKS", "socks5h://127.0.0.1:9050").strip()

    @classmethod
    def _tor_socks_reachable(cls, proxy_url: Optional[str] = None) -> bool:
        url = proxy_url or cls._tor_socks_url()
        parsed = urlparse(url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 9050
        try:
            with socket.create_connection((host, port), timeout=1.5):
                return True
        except OSError:
            return False

    @classmethod
    def _effective_proxy(cls) -> Optional[str]:
        explicit = os.getenv("YTDLP_PROXY", "").strip()
        if explicit:
            return explicit
        if cls._env_flag("YTDLP_USE_TOR", default=False):
            return cls._tor_socks_url()
        if cls._env_flag("YTDLP_AUTO_TOR", default=True) and cls._tor_socks_reachable():
            return cls._tor_socks_url()
        return None

    @staticmethod
    def _node_js_runtime() -> Optional[str]:
        configured = os.getenv("YTDLP_NODE_PATH", "").strip()
        if configured and Path(configured).exists():
            return configured
        for candidate in (
            "/exec-daemon/node",
            shutil.which("node") or "",
        ):
            if candidate and Path(candidate).exists():
                return candidate
        return None

    @staticmethod
    def _cookie_file_path() -> Optional[str]:
        cookie_file = os.getenv("YTDLP_COOKIE_FILE", "").strip()
        if cookie_file and Path(cookie_file).exists():
            return cookie_file
        return None

    @staticmethod
    def _cookies_from_browser() -> Optional[Tuple[str, ...]]:
        raw = os.getenv("YTDLP_COOKIES_FROM_BROWSER", "").strip()
        if not raw:
            return None

        parts = tuple(part.strip() for part in raw.split(":") if part.strip())
        return parts or None

    def _resolve_ffmpeg_path(self) -> Tuple[Optional[str], str]:
        direct = shutil.which("ffmpeg")
        if direct:
            return direct, "system_path"

        embedded_candidates = [
            self.backend_root / "ffmpeg-master-latest-win64-gpl" / "bin" / "ffmpeg.exe",
            self.backend_root / "ffmpeg" / "bin" / "ffmpeg.exe",
            self.backend_root / "bin" / "ffmpeg.exe",
        ]
        for candidate in embedded_candidates:
            if candidate.exists():
                return str(candidate.resolve()), "repo_bundle"

        try:
            import imageio_ffmpeg

            imageio_path = imageio_ffmpeg.get_ffmpeg_exe()
            if imageio_path and Path(imageio_path).exists():
                return imageio_path, "imageio_ffmpeg"
        except Exception:
            pass

        return None, "not_found"
