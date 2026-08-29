"""Extraction failure classification + upload ingest unit tests (no network)."""

import sys
import wave
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pytest.importorskip("yt_dlp")

from services.audio_pipeline import (  # noqa: E402
    AudioPipelineService,
    classify_extraction_failure,
    pot_provider_installed,
)


def test_classify_network_block():
    attempts = [
        {
            "name": "default_best_audio",
            "status": "failed",
            "error": "Unable to connect to proxy: Tunnel connection failed: 403 Forbidden",
        },
    ]
    result = classify_extraction_failure(attempts)
    assert result["category"] == "network_blocked"


def test_classify_bot_detection():
    attempts = [
        {
            "name": "default_best_audio",
            "status": "failed",
            "error": "Sign in to confirm you're not a bot",
        },
    ]
    result = classify_extraction_failure(attempts)
    assert result["category"] == "bot_detection"
    assert "upload" in result["hint"].lower()


def test_classify_unknown_falls_back():
    attempts = [{"name": "x", "status": "failed", "error": "some totally unrelated error"}]
    result = classify_extraction_failure(attempts)
    assert result["category"] == "unknown"


def test_classify_empty_attempts():
    result = classify_extraction_failure([])
    assert result["category"] == "unknown"


def test_pot_provider_installed_returns_bool():
    assert isinstance(pot_provider_installed(), bool)


def test_attempt_specs_include_community_clients(tmp_path, monkeypatch):
    monkeypatch.delenv("YTDLP_COOKIE_FILE", raising=False)
    monkeypatch.delenv("YTDLP_COOKIES_FROM_BROWSER", raising=False)
    monkeypatch.delenv("YTDLP_PROXY", raising=False)
    monkeypatch.delenv("YTDLP_USE_TOR", raising=False)
    monkeypatch.setenv("YTDLP_AUTO_TOR", "false")
    pipeline = AudioPipelineService(storage_root=tmp_path)
    names = [spec["name"] for spec in pipeline._attempt_specs(tmp_path)]
    assert "android_vr" in names
    assert "tv_web_safari" in names
    assert "web_embedded" in names
    assert not any(name.startswith("proxy_") for name in names)


def test_attempt_specs_include_proxy_when_tor_enabled(tmp_path, monkeypatch):
    monkeypatch.delenv("YTDLP_COOKIE_FILE", raising=False)
    monkeypatch.delenv("YTDLP_COOKIES_FROM_BROWSER", raising=False)
    monkeypatch.delenv("YTDLP_PROXY", raising=False)
    monkeypatch.setenv("YTDLP_USE_TOR", "true")
    monkeypatch.setenv("YTDLP_AUTO_TOR", "false")
    pipeline = AudioPipelineService(storage_root=tmp_path)
    names = [spec["name"] for spec in pipeline._attempt_specs(tmp_path)]
    assert names[0] == "proxy_default_best_audio"
    specs = {spec["name"]: spec for spec in pipeline._attempt_specs(tmp_path)}
    assert specs["proxy_default_best_audio"]["opts"]["proxy"] == "socks5h://127.0.0.1:9050"
    assert specs["proxy_default_best_audio"]["opts"]["js_runtimes"]["node"]["path"]


def test_attempt_specs_cookie_excludes_web_creator(tmp_path, monkeypatch):
    cookie = tmp_path / "cookies.txt"
    cookie.write_text("# Netscape HTTP Cookie File\n", encoding="utf-8")
    monkeypatch.setenv("YTDLP_COOKIE_FILE", str(cookie))
    monkeypatch.delenv("YTDLP_COOKIES_FROM_BROWSER", raising=False)
    pipeline = AudioPipelineService(storage_root=tmp_path / "store")
    specs = {spec["name"]: spec for spec in pipeline._attempt_specs(tmp_path)}
    assert "cookie_file_default_minus_web_creator" in specs
    clients = specs["cookie_file_default_minus_web_creator"]["opts"]["extractor_args"]["youtube"]["player_client"]
    assert "-web_creator" in clients


def _tiny_wav_bytes() -> bytes:
    import io

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(8000)
        wf.writeframes(b"\x00\x00" * 800)  # 0.1s silence
    return buf.getvalue()


def test_ingest_uploaded_audio(tmp_path):
    pipeline = AudioPipelineService(storage_root=tmp_path)
    record = pipeline.ingest_uploaded_audio(
        filename="demo.wav",
        data=_tiny_wav_bytes(),
        title="Demo Song",
        artist="Friend",
    )
    assert record["source_type"] == "upload"
    assert record["title"] == "Demo Song"
    assert Path(record["audio_path"]).exists()
    loaded = pipeline.load_record(record["audio_id"])
    assert loaded["audio_id"] == record["audio_id"]


def test_ingest_rejects_bad_extension(tmp_path):
    pipeline = AudioPipelineService(storage_root=tmp_path)
    with pytest.raises(ValueError, match="Unsupported"):
        pipeline.ingest_uploaded_audio(filename="notes.txt", data=b"hello")
