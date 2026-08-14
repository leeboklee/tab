"""Cloud analysis forwarding tests (no real remote server)."""

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pytest.importorskip("fastapi")

from real_analysis_main import (  # noqa: E402
    AnalysisRequest,
    _cloud_analysis_status,
    _forward_to_cloud_analysis,
)


def test_cloud_status_unconfigured(monkeypatch):
    monkeypatch.delenv("CLOUD_ANALYSIS_API_BASE", raising=False)
    monkeypatch.delenv("CLOUD_ANALYSIS_API_KEY", raising=False)
    status = _cloud_analysis_status()
    assert status["configured"] is False
    assert status["api_key_configured"] is False
    assert status["timeout_sec"] == 900


def test_forward_returns_none_when_unconfigured(monkeypatch):
    monkeypatch.delenv("CLOUD_ANALYSIS_API_BASE", raising=False)
    request = AnalysisRequest(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", quality="cloud")
    assert _forward_to_cloud_analysis(request) is None


def test_forward_posts_analyze_and_coerces_success(monkeypatch):
    monkeypatch.setenv("CLOUD_ANALYSIS_API_BASE", "https://cloud.example")
    monkeypatch.setenv("CLOUD_ANALYSIS_API_KEY", "secret")
    request = AnalysisRequest(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", quality="cloud")

    fake = SimpleNamespace(
        raise_for_status=lambda: None,
        json=lambda: {"success": True, "data": {"ok": True}, "error": None},
    )
    with patch("real_analysis_main.requests.post", return_value=fake) as mocked:
        result = _forward_to_cloud_analysis(request)

    assert result is not None
    assert result.success is True
    assert result.data == {"ok": True}
    mocked.assert_called_once()
    args, kwargs = mocked.call_args
    assert args[0] == "https://cloud.example/analyze"
    assert kwargs["json"] == {"url": request.url, "quality": "local_quality"}
    assert kwargs["headers"]["Authorization"] == "Bearer secret"
