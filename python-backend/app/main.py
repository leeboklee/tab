"""Guitar2Tabs 분석 API (단일 진입점).

이전에는 `*_main.py` 11개가 서로 다른 기능을 조금씩 나눠 갖고 있었다.
그 기능들을 전부 이 진입점과 `app/pipeline/*` 모듈로 흡수했다.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .config import settings
from .pipeline.analyzer import Analyzer, normalize_quality
from .pipeline.youtube import AudioExtractionError, YouTubeExtractor
from .schemas import AnalyzeFromAudioRequest, AnalyzeRequest, ApiResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

API_VERSION = "3.0.0"

app = FastAPI(title="Guitar2Tabs Analysis API", version=API_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

extractor = YouTubeExtractor(
    storage_root=settings.storage_root,
    cookie_file=settings.ytdlp_cookie_file,
    cookies_from_browser=settings.ytdlp_cookies_from_browser,
)
analyzer = Analyzer(settings=settings, extractor=extractor)


def _forward_to_cloud(request: AnalyzeRequest) -> Optional[Dict[str, Any]]:
    """분리/채보가 무거운 환경에서 외부 워커로 위임한다."""
    if not settings.cloud_configured():
        return None

    headers = {"Content-Type": "application/json"}
    if settings.cloud_api_key:
        headers["Authorization"] = f"Bearer {settings.cloud_api_key}"

    response = requests.post(
        f"{settings.cloud_api_base}/analyze",
        json={"url": request.url, "quality": "high"},
        headers=headers,
        timeout=settings.cloud_timeout_sec,
    )
    response.raise_for_status()
    return response.json()


# ---------------------------------------------------------------- 상태 확인


@app.get("/")
async def root() -> Dict[str, Any]:
    return {"message": "Guitar2Tabs Analysis API", "version": API_VERSION, "status": "running"}


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "version": API_VERSION,
        "services": {"audio_pipeline": extractor.diagnostics(), **analyzer.capabilities()},
    }


@app.get("/capabilities", response_model=ApiResponse)
async def capabilities() -> ApiResponse:
    return ApiResponse(
        success=True,
        data={"audio_pipeline": extractor.diagnostics(), **analyzer.capabilities()},
    )


# 이전 프론트엔드가 호출하던 경로. 유지한다.
@app.get("/test-audio-analysis", response_model=ApiResponse)
async def test_audio_analysis() -> ApiResponse:
    return await capabilities()


# ---------------------------------------------------------------- 추출


@app.post("/extract-audio", response_model=ApiResponse)
async def extract_audio(request: AnalyzeRequest) -> ApiResponse:
    try:
        record = await run_in_threadpool(extractor.extract, request.url)
        return ApiResponse(success=True, data=record)
    except AudioExtractionError as exc:
        logger.error("Audio extraction failed: %s", exc)
        return ApiResponse(success=False, error=str(exc), data={"diagnostics": exc.diagnostics})
    except Exception as exc:
        logger.exception("Unexpected extraction error")
        return ApiResponse(success=False, error=str(exc))


@app.get("/audio/{audio_id}", response_model=ApiResponse)
async def get_audio_record(audio_id: str) -> ApiResponse:
    try:
        return ApiResponse(success=True, data=extractor.load_record(audio_id))
    except Exception as exc:
        return ApiResponse(success=False, error=str(exc))


# ---------------------------------------------------------------- 분석


@app.post("/analyze-from-audio", response_model=ApiResponse)
async def analyze_from_audio(request: AnalyzeFromAudioRequest) -> ApiResponse:
    try:
        record = extractor.load_record(request.audio_id)
        data = await run_in_threadpool(analyzer.analyze_record, record, normalize_quality(request.quality))
        return ApiResponse(success=True, data=data)
    except Exception as exc:
        logger.exception("Analyze-from-audio failed")
        return ApiResponse(success=False, error=str(exc))


@app.post("/analyze", response_model=ApiResponse)
async def analyze(request: AnalyzeRequest) -> ApiResponse:
    try:
        if (request.quality or "").strip().lower() == "cloud":
            forwarded = await run_in_threadpool(_forward_to_cloud, request)
            if forwarded is not None:
                return ApiResponse(**forwarded) if "success" in forwarded else ApiResponse(success=True, data=forwarded)

        data = await run_in_threadpool(analyzer.analyze_url, request.url, normalize_quality(request.quality))
        return ApiResponse(success=True, data=data)
    except AudioExtractionError as exc:
        logger.error("Analyze failed at extraction stage: %s", exc)
        return ApiResponse(
            success=False,
            error="Audio extraction failed before analysis",
            data={"diagnostics": exc.diagnostics, "failed_stage": "youtube_extraction"},
        )
    except Exception as exc:
        logger.exception("Analyze failed")
        return ApiResponse(success=False, error=str(exc), data={"failed_stage": "analysis"})


# 구버전 별칭.
@app.post("/analyze-audio", response_model=ApiResponse)
async def analyze_audio_alias(request: AnalyzeRequest) -> ApiResponse:
    return await analyze(request)


def run() -> None:
    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
