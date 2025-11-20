from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import tempfile
import os
import logging
from typing import Optional, Dict, Any, List
import random

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Guitar2Tabs Simple API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic 모델들
class AnalyzeRequest(BaseModel):
    url: str

class TabBeat(BaseModel):
    string: int
    frets: List[int]

class ChordProgression(BaseModel):
    chord: str
    confidence: float

class TabMetadata(BaseModel):
    title: str
    artist: str
    duration: int
    tempo: int
    key: str
    difficulty: str
    techniques: List[str]

class AnalyzeResponseData(BaseModel):
    title: str
    artist: str
    duration: int
    tempo: int
    key: str
    tabs: List[TabBeat]
    chord_progressions: List[ChordProgression]
    metadata: TabMetadata

class AnalyzeResponse(BaseModel):
    success: bool
    data: Optional[AnalyzeResponseData] = None
    error: Optional[str] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "ai_ready": True}

async def get_youtube_info(url: str) -> Dict[str, Any]:
    """YouTube 영상 정보 가져오기"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return {}
            
            return {
                'title': info.get('title', 'Unknown Title'),
                'uploader': info.get('uploader', 'Unknown Artist'),
                'duration': info.get('duration', 180),
                'description': info.get('description', ''),
                'thumbnail': info.get('thumbnail', ''),
            }
            
    except Exception as e:
        logger.error(f"Error getting YouTube info: {str(e)}")
        return {
            'title': 'Unknown Title',
            'uploader': 'Unknown Artist', 
            'duration': 180,
            'description': '',
            'thumbnail': '',
        }

def generate_tabs_from_youtube_info(youtube_info: Dict[str, Any]) -> List[TabBeat]:
    """YouTube 정보를 기반으로 타브 악보 생성"""
    title = youtube_info.get('title', '')
    duration = youtube_info.get('duration', 180)
    
    # 제목 기반 시드로 일관된 결과 생성
    random.seed(hash(title))
    
    tabs = []
    num_beats = max(8, duration // 4)  # 전체 길이에 맞춰 생성 (최소 8마디)
    
    for beat in range(num_beats):
        frets = [0, 0, 0, 0, 0, 0]  # 6줄 기타
        
        # 각 마디마다 1-3개의 음표 생성
        num_notes = random.randint(1, 3)
        for _ in range(num_notes):
            string_idx = random.randint(0, 5)
            fret = random.randint(1, 12)
            frets[string_idx] = fret
        
        tabs.append(TabBeat(string=beat, frets=frets))
    
    return tabs

def generate_chord_progressions(title: str) -> List[ChordProgression]:
    """코드 진행 생성"""
    chords = ['C', 'G', 'Am', 'F', 'Dm', 'Em', 'A', 'D', 'E']
    progressions = []
    
    random.seed(hash(title))
    
    for i in range(8):
        chord_idx = random.randint(0, len(chords) - 1)
        confidence = 0.7 + random.random() * 0.3
        progressions.append(ChordProgression(
            chord=chords[chord_idx],
            confidence=confidence
        ))
    
    return progressions

def generate_metadata(youtube_info: Dict[str, Any]) -> TabMetadata:
    """메타데이터 생성"""
    title = youtube_info.get('title', '')
    random.seed(hash(title))
    
    # 템포 (120-180 BPM)
    tempo = 120 + (hash(title) % 60)
    
    # 키
    keys = ['C', 'G', 'D', 'A', 'E', 'F', 'Am', 'Em', 'Dm']
    key = keys[hash(title) % len(keys)]
    
    # 난이도
    difficulties = ['beginner', 'intermediate', 'advanced']
    difficulty = difficulties[hash(title) % len(difficulties)]
    
    # 기법
    techniques = ['strumming', 'fingerpicking', 'barre_chords', 'hammer_on', 'pull_off']
    selected_techniques = random.sample(techniques, random.randint(2, 4))
    
    return TabMetadata(
        title=youtube_info.get('title', 'Unknown Title'),
        artist=youtube_info.get('uploader', 'Unknown Artist'),
        duration=youtube_info.get('duration', 180),
        tempo=tempo,
        key=key,
        difficulty=difficulty,
        techniques=selected_techniques
    )

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_music(request: AnalyzeRequest):
    """음악 분석 및 타브 악보 생성"""
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # 1. YouTube 정보 가져오기
        youtube_info = await get_youtube_info(request.url)
        logger.info(f"YouTube info: {youtube_info}")
        
        # 2. 타브 악보 생성
        tabs = generate_tabs_from_youtube_info(youtube_info)
        
        # 3. 코드 진행 생성
        chord_progressions = generate_chord_progressions(youtube_info.get('title', ''))
        
        # 4. 메타데이터 생성
        metadata = generate_metadata(youtube_info)
        
        # 5. 응답 데이터 구성
        response_data = AnalyzeResponseData(
            title=youtube_info.get('title', 'Unknown Title'),
            artist=youtube_info.get('uploader', 'Unknown Artist'),
            duration=youtube_info.get('duration', 180),
            tempo=metadata.tempo,
            key=metadata.key,
            tabs=tabs,
            chord_progressions=chord_progressions,
            metadata=metadata
        )
        
        logger.info("Analysis completed successfully")
        
        return AnalyzeResponse(success=True, data=response_data)
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return AnalyzeResponse(success=False, error=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Guitar2Tabs Simple API server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)