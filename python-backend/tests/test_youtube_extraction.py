"""Extraction attempt specs and cookie/POT wiring (no network download)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pytest.importorskip("yt_dlp")

from services import audio_pipeline as pipeline_mod
from services.audio_pipeline import AudioPipelineService, classify_extraction_failure, pot_provider_installed


@pytest.fixture(autouse=True)
def _reset_pot_cache(monkeypatch):
    pipeline_mod._POT_HTTP_CACHE.update({"checked_at": 0.0, "url": None, "reachable": False})
    monkeypatch.delenv("YTDLP_COOKIE_FILE", raising=False)
    monkeypatch.delenv("YTDLP_COOKIES_FROM_BROWSER", raising=False)
    monkeypatch.delenv("YTDLP_POT_BASE_URL", raising=False)
    monkeypatch.setattr(pipeline_mod, "resolve_pot_base_url", lambda: None)


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


def test_classify_unknown_falls_back():
    attempts = [{"name": "x", "status": "failed", "error": "some totally unrelated error"}]
    result = classify_extraction_failure(attempts)
    assert result["category"] == "unknown"


def test_classify_empty_attempts():
    result = classify_extraction_failure([])
    assert result["category"] == "unknown"


def test_pot_provider_installed_returns_bool():
    assert isinstance(pot_provider_installed(), bool)


def test_attempt_specs_include_cookie_mweb_when_cookie_file(tmp_path, monkeypatch):
    cookie = tmp_path / "cookies.txt"
    cookie.write_text("# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\ttest\n")
    monkeypatch.setenv("YTDLP_COOKIE_FILE", str(cookie))
    svc = AudioPipelineService(storage_root=tmp_path / "audio")
    names = [spec["name"] for spec in svc._attempt_specs(tmp_path / "work")]
    assert "cookies_mweb_pot" in names
    assert "with_cookie_file" in names
    cookie_attempt = next(spec for spec in svc._attempt_specs(tmp_path / "work") if spec["name"] == "cookies_mweb_pot")
    assert cookie_attempt["opts"]["cookiefile"] == str(cookie.resolve())
    assert cookie_attempt["opts"]["extractor_args"]["youtube"]["player_client"] == ["mweb"]


def test_cookie_file_autodetects_backend_cookies_txt(tmp_path):
    svc = AudioPipelineService(storage_root=tmp_path / "audio")
    svc.backend_root = tmp_path
    (tmp_path / "cookies.txt").write_text("# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\ttest\n")
    assert svc._cookie_file_path()
    assert svc.diagnostics()["cookie_file_configured"] is True


def test_diagnostics_marks_missing_cookie_env(tmp_path, monkeypatch):
    monkeypatch.setenv("YTDLP_COOKIE_FILE", str(tmp_path / "missing-cookies.txt"))
    svc = AudioPipelineService(storage_root=tmp_path / "audio")
    diag = svc.diagnostics()
    assert diag["cookie_file_configured"] is False
    assert diag["cookie_file_env_missing"] is True
    assert "pot_http_reachable" in diag


def test_ydl_opts_attach_pot_base_url(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline_mod, "resolve_pot_base_url", lambda: "http://127.0.0.1:4416")
    svc = AudioPipelineService(storage_root=tmp_path / "audio")
    opts = svc._build_ydl_opts(tmp_path / "work")
    assert opts["extractor_args"]["youtubepot-bgutilhttp"]["base_url"] == ["http://127.0.0.1:4416"]
