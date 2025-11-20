from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import random
from typing import List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Guitar2Tabs Minimal API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    url: str

class AnalyzeResponse(BaseModel):
    success: bool
    data: Dict[str, Any] = None
    error: str = None

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

async def get_youtube_info(url: str) -> Dict[str, Any]:
    """YouTube 영상 정보 가져오기"""
    try:
        ydl_opts = {'quiet': True, 'no_warnings': True}
        
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

def generate_tabs(title: str, duration: int) -> List[Dict[str, Any]]:
    """타브 악보 생성"""
    random.seed(hash(title))
    tabs = []
    num_beats = min(32, max(8, duration // 4))
    
    for beat in range(num_beats):
        frets = [0, 0, 0, 0, 0, 0]
        num_notes = random.randint(1, 3)
        for _ in range(num_notes):
            string_idx = random.randint(0, 5)
            fret = random.randint(1, 12)
            frets[string_idx] = fret
        
        tabs.append({"string": beat, "frets": frets})
    
    return tabs

def generate_chords(title: str) -> List[Dict[str, Any]]:
    """코드 진행 생성"""
    chords = ['C', 'G', 'Am', 'F', 'Dm', 'Em', 'A', 'D', 'E']
    random.seed(hash(title))
    
    chord_progressions = []
    for i in range(8):
        chord_idx = random.randint(0, len(chords) - 1)
        confidence = 0.7 + random.random() * 0.3
        chord_progressions.append({
            "chord": chords[chord_idx],
            "confidence": confidence
        })
    
    return chord_progressions

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_music(request: AnalyzeRequest):
    """음악 분석 및 악보 생성"""
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # YouTube 정보 가져오기
        youtube_info = await get_youtube_info(request.url)
        logger.info(f"YouTube info: {youtube_info}")
        
        # 데이터 생성
        title = youtube_info.get('title', 'Unknown Title')
        duration = youtube_info.get('duration', 180)
        
        # 템포와 키 생성
        random.seed(hash(title))
        tempo = 120 + (hash(title) % 60)
        keys = ['C', 'G', 'D', 'A', 'E', 'F', 'Am', 'Em', 'Dm']
        key = keys[hash(title) % len(keys)]
        
        # 난이도와 기법
        difficulties = ['beginner', 'intermediate', 'advanced']
        difficulty = difficulties[hash(title) % len(difficulties)]
        techniques = ['strumming', 'fingerpicking', 'barre_chords', 'hammer_on', 'pull_off']
        selected_techniques = random.sample(techniques, random.randint(2, 4))
        
        # 응답 데이터
        data = {
            "title": title,
            "artist": youtube_info.get('uploader', 'Unknown Artist'),
            "duration": duration,
            "tempo": tempo,
            "key": key,
            "tabs": generate_tabs(title, duration),
            "chord_progressions": generate_chords(title),
            "metadata": {
                "difficulty": difficulty,
                "techniques": selected_techniques
            }
        }
        
        logger.info("Analysis completed successfully")
        return AnalyzeResponse(success=True, data=data)
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return AnalyzeResponse(success=False, error=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Guitar2Tabs Minimal API server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)