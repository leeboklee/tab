"""API 요청/응답 스키마."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    url: str = Field(..., description="YouTube URL")
    quality: str = Field("balanced", description="fast | balanced | high")


class AnalyzeFromAudioRequest(BaseModel):
    audio_id: str = Field(..., description="추출 단계에서 발급된 음원 ID")
    quality: str = Field("balanced", description="fast | balanced | high")


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
