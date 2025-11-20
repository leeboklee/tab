from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import yt_dlp
import tempfile
import os
import json
import numpy as np
import asyncio
from typing import Optional, Dict, Any, List, Tuple
import logging

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
    allow_origins=["http://localhost:3009", "http://127.0.0.1:3009"],
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
    return {"status": "healthy"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_music(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    유튜브 URL을 분석하여 기타 타브 악보를 생성합니다.
    """
    try:
        logger.info(f"Starting analysis for URL: {request.url}")
        
        # 1. 유튜브에서 비디오 정보 추출
        video_info = await extract_video_info(request.url)
        if not video_info:
            raise HTTPException(status_code=400, detail="Failed to extract video info")
        
        # 2. AI 기반 오디오 분석 (시뮬레이션)
        analysis_result = await analyze_audio_ai(video_info)
        
        # 3. 타브 악보 생성
        tab_data = await generate_advanced_tab(analysis_result, video_info)
        
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

async def extract_video_info(url: str) -> Optional[Dict[str, Any]]:
    """유튜브 비디오 정보 추출"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return None
            
            return {
                'title': info.get('title', 'Unknown'),
                'artist': info.get('uploader', 'Unknown'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'description': info.get('description', ''),
                'view_count': info.get('view_count', 0),
                'upload_date': info.get('upload_date', ''),
                'url': url
            }
            
    except Exception as e:
        logger.error(f"Error extracting video info: {str(e)}")
        return None

async def analyze_audio_ai(video_info: Dict[str, Any]) -> Dict[str, Any]:
    """AI 기반 오디오 분석 (시뮬레이션)"""
    try:
        # 실제로는 여기서 librosa, tensorflow 등을 사용하여 오디오 분석
        # 현재는 시뮬레이션된 분석 결과 반환
        
        duration = video_info.get('duration', 180)  # 기본 3분
        
        # 템포 분석 (AI 시뮬레이션)
        tempo = np.random.normal(120, 20)  # 120 BPM 중심, 표준편차 20
        tempo = max(60, min(200, tempo))  # 60-200 BPM 범위로 제한
        
        # 키 분석 (AI 시뮬레이션)
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        modes = ['major', 'minor']
        key = np.random.choice(keys)
        mode = np.random.choice(modes)
        
        # 피치 분석 (AI 시뮬레이션)
        # 실제로는 CREPE 모델 등을 사용
        pitch_contour = generate_realistic_pitch_contour(duration, tempo)
        
        # 리듬 분석 (AI 시뮬레이션)
        rhythm_pattern = analyze_rhythm_pattern(tempo, duration)
        
        # 코드 진행 분석 (AI 시뮬레이션)
        chord_progression = generate_chord_progression(key, mode, duration, tempo)
        
        return {
            'tempo': float(tempo),
            'key': key,
            'mode': mode,
            'pitch_contour': pitch_contour,
            'rhythm_pattern': rhythm_pattern,
            'chord_progression': chord_progression,
            'duration': duration,
            'ai_confidence': np.random.uniform(0.7, 0.95)
        }
        
    except Exception as e:
        logger.error(f"Error in AI analysis: {str(e)}")
        raise

def generate_realistic_pitch_contour(duration: int, tempo: float) -> List[float]:
    """현실적인 피치 컨투어 생성 (AI 시뮬레이션)"""
    # 실제로는 CREPE 모델 등을 사용
    sample_rate = 22050
    hop_length = 512
    frames = int(duration * sample_rate / hop_length)
    
    # 기본 멜로디 패턴 생성
    base_freq = 440  # A4
    pitch_contour = []
    
    for i in range(frames):
        # 하모닉 시리즈 기반 피치 생성
        harmonic = 1 + (i % 8)  # 1-8 하모닉
        freq = base_freq * harmonic
        
        # 템포에 따른 리듬 변화
        beat_position = (i * hop_length / sample_rate) * (tempo / 60)
        if beat_position % 1 < 0.3:  # 비트 시작 부분
            freq *= 1.2  # 약간 높은 피치
        
        # 노이즈 추가 (현실감)
        noise = np.random.normal(1, 0.05)
        freq *= noise
        
        pitch_contour.append(freq)
    
    return pitch_contour

def analyze_rhythm_pattern(tempo: float, duration: int) -> Dict[str, Any]:
    """리듬 패턴 분석 (AI 시뮬레이션)"""
    # 실제로는 librosa.beat.beat_track() 등을 사용
    
    beat_duration = 60.0 / tempo
    total_beats = int(duration / beat_duration)
    
    # 리듬 복잡도 분석
    if tempo < 100:
        complexity = "simple"
    elif tempo < 140:
        complexity = "moderate"
    else:
        complexity = "complex"
    
    # 온셋 패턴 생성
    onsets = []
    for i in range(total_beats):
        if i % 4 == 0:  # 강박
            onsets.append(i * beat_duration)
        elif i % 2 == 0 and np.random.random() > 0.3:  # 약박
            onsets.append(i * beat_duration)
        elif np.random.random() > 0.7:  # 추가 비트
            onsets.append(i * beat_duration + np.random.uniform(0, beat_duration))
    
    return {
        'pattern_type': complexity,
        'density': len(onsets) / duration,
        'onsets': onsets,
        'beat_duration': beat_duration
    }

def generate_chord_progression(key: str, mode: str, duration: int, tempo: float) -> List[Dict[str, Any]]:
    """코드 진행 생성 (AI 시뮬레이션)"""
    # 실제로는 하모니 분석을 통해 코드 진행 추출
    
    # 기본 코드 딕셔너리
    major_chords = {
        'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
        'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
        'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
        'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'],
        'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'],
    }
    
    minor_chords = {
        'Am': ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'],
        'Em': ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D'],
        'Dm': ['Dm', 'Edim', 'F', 'Gm', 'Am', 'Bb', 'C'],
    }
    
    # 키에 따른 코드 선택
    if mode == 'major':
        available_chords = major_chords.get(key, major_chords['C'])
    else:
        available_chords = minor_chords.get(key, minor_chords['Am'])
    
    # 코드 진행 생성
    beat_duration = 60.0 / tempo
    total_beats = int(duration / beat_duration)
    chord_progression = []
    
    # 일반적인 코드 진행 패턴
    common_progressions = [
        [0, 3, 4, 0],  # I-IV-V-I
        [0, 5, 3, 4],  # I-vi-IV-V
        [0, 2, 5, 0],  # I-iii-vi-I
    ]
    
    progression = np.random.choice(common_progressions)
    
    for i in range(0, total_beats, 4):  # 4비트마다 코드 변경
        chord_index = progression[(i // 4) % len(progression)]
        chord = available_chords[chord_index]
        
        chord_progression.append({
            'beat': i,
            'chord': chord,
            'confidence': np.random.uniform(0.7, 0.95),
            'duration': min(4 * beat_duration, (total_beats - i) * beat_duration)
        })
    
    return chord_progression

async def generate_advanced_tab(analysis_result: Dict[str, Any], video_info: Dict[str, Any]) -> Dict[str, Any]:
    """고급 타브 악보 생성"""
    try:
        tempo = analysis_result['tempo']
        key = analysis_result['key']
        mode = analysis_result['mode']
        chord_progression = analysis_result['chord_progression']
        pitch_contour = analysis_result['pitch_contour']
        rhythm_pattern = analysis_result['rhythm_pattern']
        
        # 타브 생성
        tabs = []
        beat_duration = 60.0 / tempo
        total_beats = int(video_info['duration'] / beat_duration)
        
        for beat in range(total_beats):
            # 현재 비트의 코드 찾기
            current_chord = None
            for chord_info in chord_progression:
                if chord_info['beat'] <= beat < chord_info['beat'] + 4:
                    current_chord = chord_info['chord']
                    break
            
            # 코드를 기타 프렛으로 변환
            chord_frets = chord_to_frets(current_chord or 'C')
            
            # 멜로디 라인 추가 (피치 컨투어 기반)
            melody_frets = generate_melody_frets(pitch_contour, beat, beat_duration)
            
            # 최종 프렛 배열 생성
            frets = [0, 0, 0, 0, 0, 0]  # 6줄
            
            # 코드 프렛 추가
            for string_idx, fret in enumerate(chord_frets):
                if 0 <= string_idx < 6:
                    frets[5 - string_idx] = fret  # 6번 줄부터 1번 줄
            
            # 멜로디 프렛 추가 (상위 3줄)
            for string_idx, fret in enumerate(melody_frets):
                if 0 <= string_idx < 3 and fret > 0:
                    frets[2 - string_idx] = fret  # 3번, 2번, 1번 줄
            
            tabs.append({
                'beat': beat + 1,
                'string': 6,
                'frets': frets
            })
        
        # 난이도 계산
        difficulty = calculate_difficulty(tabs)
        
        # 연주 기법 식별
        techniques = identify_techniques(tabs)
        
        return {
            'title': video_info.get('title', 'Unknown'),
            'artist': video_info.get('artist', 'Unknown'),
            'duration': video_info.get('duration', 0),
            'tempo': int(tempo),
            'key': key,
            'mode': mode,
            'difficulty': difficulty,
            'techniques': techniques,
            'tabs': tabs,
            'chord_progression': chord_progression,
            'metadata': {
                'generator': 'Guitar2Tabs AI',
                'version': '1.0.0',
                'ai_confidence': analysis_result['ai_confidence'],
                'processing_time': 2.5
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating advanced tab: {str(e)}")
        raise

def chord_to_frets(chord: str) -> List[int]:
    """코드를 기타 프렛으로 변환"""
    chord_dict = {
        'C': [3, 3, 0, 0, 1, 0],
        'C#': [4, 4, 1, 1, 2, 1],
        'D': [2, 0, 0, 2, 3, 2],
        'D#': [3, 1, 1, 3, 4, 3],
        'E': [0, 2, 2, 1, 0, 0],
        'F': [1, 3, 3, 2, 1, 1],
        'F#': [2, 4, 4, 3, 2, 2],
        'G': [3, 2, 0, 0, 3, 3],
        'G#': [4, 3, 1, 1, 4, 4],
        'A': [0, 0, 2, 2, 2, 0],
        'A#': [1, 1, 3, 3, 3, 1],
        'B': [2, 2, 4, 4, 4, 2],
        'Am': [0, 0, 2, 2, 1, 0],
        'Bm': [2, 2, 4, 4, 3, 2],
        'Cm': [3, 3, 5, 5, 4, 3],
        'Dm': [1, 0, 0, 2, 3, 1],
        'Em': [0, 2, 2, 0, 0, 0],
        'Fm': [1, 3, 3, 1, 1, 1],
        'Gm': [3, 1, 0, 0, 3, 3],
    }
    
    return chord_dict.get(chord, [0, 0, 0, 0, 0, 0])

def generate_melody_frets(pitch_contour: List[float], beat: int, beat_duration: float) -> List[int]:
    """멜로디 프렛 생성"""
    # 피치를 기타 프렛으로 변환
    frets = [0, 0, 0]  # 상위 3줄
    
    # 해당 비트의 피치 샘플 선택
    start_frame = int(beat * beat_duration * 22050 / 512)
    end_frame = int((beat + 1) * beat_duration * 22050 / 512)
    
    if start_frame < len(pitch_contour):
        # 평균 피치 계산
        sample_pitches = pitch_contour[start_frame:min(end_frame, len(pitch_contour))]
        if sample_pitches:
            avg_pitch = np.mean(sample_pitches)
            
            # 피치를 프렛으로 변환 (간단한 방법)
            if avg_pitch > 0:
                # A4 (440Hz)를 기준으로 프렛 계산
                fret = int(12 * np.log2(avg_pitch / 440) + 12)
                fret = max(0, min(24, fret))  # 0-24 프렛 범위
                
                # 상위 3줄 중 하나에 배치
                string_idx = np.random.randint(0, 3)
                frets[string_idx] = fret
    
    return frets

def calculate_difficulty(tabs: List[Dict[str, Any]]) -> str:
    """난이도 계산"""
    if not tabs:
        return "beginner"
    
    max_fret = 0
    complex_patterns = 0
    
    for tab in tabs:
        frets = tab.get('frets', [])
        max_fret = max(max_fret, max(frets) if frets else 0)
        
        # 복잡한 패턴 검사
        non_zero_frets = [f for f in frets if f > 0]
        if len(non_zero_frets) > 3:
            complex_patterns += 1
    
    if max_fret <= 5 and complex_patterns < len(tabs) * 0.3:
        return "beginner"
    elif max_fret <= 12 and complex_patterns < len(tabs) * 0.6:
        return "intermediate"
    else:
        return "advanced"

def identify_techniques(tabs: List[Dict[str, Any]]) -> List[str]:
    """연주 기법 식별"""
    techniques = []
    
    if not tabs:
        return techniques
    
    for tab in tabs:
        frets = tab.get('frets', [])
        
        # 바레 코드 검사
        if len([f for f in frets if f > 0]) >= 4:
            techniques.append("barre_chord")
        
        # 하이 프렛 사용
        if max(frets) > 12:
            techniques.append("high_fret")
        
        # 복잡한 패턴
        non_zero_count = len([f for f in frets if f > 0])
        if non_zero_count > 3:
            techniques.append("complex_pattern")
    
    return list(set(techniques))

async def process_audio_async(task_id: str, url: str, options: Dict[str, Any]):
    """비동기 오디오 처리"""
    try:
        processing_tasks[task_id]["progress"] = 10
        
        # 1. 유튜브에서 비디오 정보 추출
        video_info = await extract_video_info(url)
        processing_tasks[task_id]["progress"] = 30
        
        # 2. AI 기반 오디오 분석
        analysis_result = await analyze_audio_ai(video_info)
        processing_tasks[task_id]["progress"] = 60
        
        # 3. 타브 악보 생성
        tab_data = await generate_advanced_tab(analysis_result, video_info)
        processing_tasks[task_id]["progress"] = 100
        
        processing_tasks[task_id]["status"] = "completed"
        processing_tasks[task_id]["result"] = tab_data
        
    except Exception as e:
        logger.error(f"Async processing failed: {str(e)}")
        processing_tasks[task_id]["status"] = "failed"
        processing_tasks[task_id]["error"] = str(e)

if __name__ == "__main__":
    uvicorn.run(
        "advanced_main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

