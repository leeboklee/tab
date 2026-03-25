from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import asyncio
import os
from typing import Optional, Dict, Any
import logging

from services.youtube_extractor import YouTubeExtractor
from services.audio_analyzer import AudioAnalyzer
from services.tab_generator import TabGenerator
from services.ai_processor import AIProcessor

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Guitar2Tabs API",
    description="AI 기반 유튜브 음악 분석 및 기타 타브 생성 API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3019", "http://127.0.0.1:3019", "http://localhost:5958", "http://127.0.0.1:5958"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 요청 모델
class AnalyzeRequest(BaseModel):
    url: str
    options: Optional[Dict[str, Any]] = {}

class AnalyzeResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    task_id: Optional[str] = None

# 서비스 인스턴스
youtube_extractor = YouTubeExtractor()
audio_analyzer = AudioAnalyzer()
tab_generator = TabGenerator()
ai_processor = AIProcessor()

# 진행 중인 작업 저장소
processing_tasks: Dict[str, Dict[str, Any]] = {}

@app.get("/")
async def root():
    return {
        "message": "Guitar2Tabs API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "services": {
        "youtube_extractor": "ready",
        "audio_analyzer": "ready", 
        "tab_generator": "ready",
        "ai_processor": "ready"
    }}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_music(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    유튜브 URL을 분석하여 기타 타브 악보를 생성합니다.
    """
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # 1. 유튜브에서 오디오 추출
        logger.info("Extracting audio from YouTube...")
        audio_info = await youtube_extractor.extract_audio(request.url)
        
        if not audio_info:
            raise HTTPException(status_code=400, detail="Failed to extract audio from YouTube")
        
        # 2. 오디오 분석
        logger.info("Analyzing audio...")
        analysis_result = await audio_analyzer.analyze_audio(audio_info['audio_path'])
        
        # 3. AI 처리
        logger.info("Processing with AI...")
        ai_result = await ai_processor.process_audio(analysis_result)
        
        # 4. 타브 악보 생성
        logger.info("Generating tab...")
        tab_data = await tab_generator.generate_tab(ai_result, audio_info)
        
        # 5. 정리
        await youtube_extractor.cleanup(audio_info['audio_path'])
        
        logger.info("Analysis completed successfully")
        
        return AnalyzeResponse(
            success=True,
            data=tab_data
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return AnalyzeResponse(
            success=False,
            error=str(e)
        )

@app.post("/analyze-async", response_model=AnalyzeResponse)
async def analyze_music_async(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    비동기로 유튜브 URL을 분석합니다. (대용량 파일용)
    """
    import uuid
    task_id = str(uuid.uuid4())
    
    # 백그라운드에서 처리 시작
    background_tasks.add_task(process_audio_async, task_id, request.url, request.options)
    
    processing_tasks[task_id] = {
        "status": "processing",
        "progress": 0,
        "result": None,
        "error": None
    }
    
    return AnalyzeResponse(
        success=True,
        task_id=task_id
    )

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """
    비동기 작업의 상태를 확인합니다.
    """
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return processing_tasks[task_id]

async def process_audio_async(task_id: str, url: str, options: Dict[str, Any]):
    """
    백그라운드에서 오디오를 처리합니다.
    """
    try:
        processing_tasks[task_id]["progress"] = 10
        
        # 1. 유튜브에서 오디오 추출
        audio_info = await youtube_extractor.extract_audio(url)
        processing_tasks[task_id]["progress"] = 30
        
        # 2. 오디오 분석
        analysis_result = await audio_analyzer.analyze_audio(audio_info['audio_path'])
        processing_tasks[task_id]["progress"] = 60
        
        # 3. AI 처리
        ai_result = await ai_processor.process_audio(analysis_result)
        processing_tasks[task_id]["progress"] = 80
        
        # 4. 타브 악보 생성
        tab_data = await tab_generator.generate_tab(ai_result, audio_info)
        processing_tasks[task_id]["progress"] = 100
        
        # 5. 정리
        await youtube_extractor.cleanup(audio_info['audio_path'])
        
        processing_tasks[task_id]["status"] = "completed"
        processing_tasks[task_id]["result"] = tab_data
        
    except Exception as e:
        logger.error(f"Async processing failed: {str(e)}")
        processing_tasks[task_id]["status"] = "failed"
        processing_tasks[task_id]["error"] = str(e)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )


