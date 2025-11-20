"""
실제 오디오 분석을 통한 타브 생성 메인 서버
"""

import asyncio
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uvicorn

from services.audio_analyzer import audio_analyzer
from services.tab_generator import TabGenerator

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Guitar2Tabs Real Audio Analysis API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3009", "http://localhost:5958", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 요청 모델
class AudioAnalysisRequest(BaseModel):
    url: str
    analysis_type: str = "full"  # full, tempo_only, key_only, chords_only

class AudioAnalysisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None

# 타브 생성기 초기화
tab_generator = TabGenerator()

@app.get("/")
async def root():
    return {"message": "Guitar2Tabs Real Audio Analysis API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/analyze-audio", response_model=AudioAnalysisResponse)
async def analyze_audio(request: AudioAnalysisRequest):
    """
    YouTube URL에서 오디오를 추출하고 실제 음악 분석을 수행합니다.
    """
    import time
    start_time = time.time()
    
    try:
        logger.info(f"Starting audio analysis for URL: {request.url}")
        
        # 1. YouTube에서 오디오 추출
        audio_path = audio_analyzer.extract_audio_from_youtube(request.url)
        if not audio_path:
            raise HTTPException(status_code=400, detail="Failed to extract audio from YouTube")
        
        # 2. 오디오 분석
        analysis_result = audio_analyzer.analyze_audio(audio_path)
        
        # 3. 타브 데이터 생성
        tab_data = await tab_generator.generate_tab(analysis_result, {
            'title': 'Analyzed Audio',
            'artist': 'Unknown',
            'duration': analysis_result['duration'],
            'processing_time': time.time() - start_time
        })
        
        # 4. 임시 파일 정리
        audio_analyzer.cleanup()
        
        processing_time = time.time() - start_time
        
        logger.info(f"Audio analysis completed in {processing_time:.2f}s")
        
        return AudioAnalysisResponse(
            success=True,
            data=tab_data,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Audio analysis failed: {str(e)}")
        
        # 에러 발생시에도 정리
        try:
            audio_analyzer.cleanup()
        except:
            pass
        
        return AudioAnalysisResponse(
            success=False,
            error=str(e),
            processing_time=time.time() - start_time
        )

@app.post("/analyze-tempo-only", response_model=AudioAnalysisResponse)
async def analyze_tempo_only(request: AudioAnalysisRequest):
    """
    템포만 빠르게 분석합니다.
    """
    import time
    start_time = time.time()
    
    try:
        logger.info(f"Starting tempo analysis for URL: {request.url}")
        
        # 오디오 추출
        audio_path = audio_analyzer.extract_audio_from_youtube(request.url)
        if not audio_path:
            raise HTTPException(status_code=400, detail="Failed to extract audio from YouTube")
        
        # 오디오 로드
        import librosa
        y, sr = librosa.load(audio_path, sr=22050)
        
        # 템포만 분석
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        
        # 정리
        audio_analyzer.cleanup()
        
        processing_time = time.time() - start_time
        
        return AudioAnalysisResponse(
            success=True,
            data={
                'tempo': float(tempo),
                'duration': len(y) / sr,
                'analysis_type': 'tempo_only'
            },
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Tempo analysis failed: {str(e)}")
        try:
            audio_analyzer.cleanup()
        except:
            pass
        
        return AudioAnalysisResponse(
            success=False,
            error=str(e),
            processing_time=time.time() - start_time
        )

@app.get("/test-audio-analysis")
async def test_audio_analysis():
    """
    테스트용 오디오 분석 (샘플 오디오 사용)
    """
    try:
        # 테스트용 샘플 오디오 생성
        import numpy as np
        import soundfile as sf
        import tempfile
        import os
        
        # 440Hz (A4) 사인파 생성
        sample_rate = 22050
        duration = 5  # 5초
        frequency = 440
        
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        audio = np.sin(2 * np.pi * frequency * t)
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            sf.write(tmp_file.name, audio, sample_rate)
            temp_path = tmp_file.name
        
        try:
            # 오디오 분석
            analysis_result = audio_analyzer.analyze_audio(temp_path)
            
            return {
                "success": True,
                "data": analysis_result,
                "message": "Test audio analysis completed"
            }
            
        finally:
            # 임시 파일 삭제
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"Test audio analysis failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/analyze-sample-audio")
async def analyze_sample_audio():
    """샘플 오디오 분석 (실제 오디오 분석 로직 사용)"""
    try:
        # 샘플 오디오 생성 및 분석
        audio_path = audio_analyzer._create_sample_audio()
        if not audio_path:
            raise Exception("Failed to create sample audio")
        
        # 실제 오디오 분석 수행
        result = audio_analyzer.analyze_audio(audio_path)
        
        # 임시 파일 정리
        audio_analyzer.cleanup()
        
        return {
            "success": True,
            "data": result,
            "processing_time": 0.5
        }
        
    except Exception as e:
        logger.error(f"Sample audio analysis failed: {e}")
        return {
            "success": False,
            "data": None,
            "error": str(e)
        }

if __name__ == "__main__":
    logger.info("Starting Real Audio Analysis Server...")
    uvicorn.run(
        "real_audio_main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
