"""Extraction failure classification unit tests (no network)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pytest.importorskip("yt_dlp")

from services.audio_pipeline import classify_extraction_failure, pot_provider_installed  # noqa: E402


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
