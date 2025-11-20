from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import yt_dlp
import librosa
import numpy as np
import json
import re
from typing import List, Dict, Any
import os
import tempfile
import subprocess
import hashlib

app = FastAPI(title="Guitar2Tabs Real Analysis API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    url: str

class TabData(BaseModel):
    title: str
    artist: str
    duration: int
    tempo: int
    key: str
    difficulty: str
    tabs: List[Dict[str, Any]]
    chord_progressions: List[Dict[str, Any]]
    metadata: Dict[str, Any]

def extract_video_id(url: str) -> str:
    """YouTube URL에서 비디오 ID 추출"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_youtube_info(url: str) -> Dict[str, Any]:
    """YouTube 비디오 정보 가져오기 (가사, 코드 정보 포함)"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,  # 상세 정보 추출을 위해 False로 변경
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # 가사 추출 시도
            lyrics = extract_lyrics_from_description(info.get('description', ''))
            
            # 코드 정보 추출 시도
            chord_info = extract_chord_info_from_description(info.get('description', ''))
            
            return {
                'title': info.get('title', 'Unknown Title'),
                'uploader': info.get('uploader', 'Unknown Artist'),
                'duration': info.get('duration', 0),
                'description': info.get('description', ''),
                'view_count': info.get('view_count', 0),
                'upload_date': info.get('upload_date', ''),
                'tags': info.get('tags', []),
                'lyrics': lyrics,
                'chord_info': chord_info,
                'thumbnail': info.get('thumbnail', ''),
                'video_id': info.get('id', '')
            }
    except Exception as e:
        print(f"Error getting YouTube info: {e}")
        return None

def extract_lyrics_from_description(description: str) -> List[Dict[str, Any]]:
    """설명에서 가사 추출"""
    try:
        lines = description.split('\n')
        lyrics = []
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # 가사 섹션 감지
            if any(keyword in line.lower() for keyword in ['lyrics', '가사', 'lyric', 'song text']):
                current_section = 'lyrics'
                continue
            elif any(keyword in line.lower() for keyword in ['chords', '코드', 'chord', '악보']):
                current_section = 'chords'
                continue
            elif any(keyword in line.lower() for keyword in ['[', ']', 'verse', 'chorus', 'bridge']):
                current_section = 'structure'
                continue
            
            # 가사 라인 추출
            if current_section == 'lyrics' and len(line) > 10:
                # 코드가 포함된 라인인지 확인
                if any(chord in line for chord in ['Am', 'F', 'C', 'G', 'D', 'E', 'A', 'B']):
                    # 코드와 가사 분리
                    parts = line.split()
                    chords = []
                    text = []
                    
                    for part in parts:
                        if any(chord in part for chord in ['Am', 'F', 'C', 'G', 'D', 'E', 'A', 'B', 'm', '7', 'sus', 'maj']):
                            chords.append(part)
                        else:
                            text.append(part)
                    
                    lyrics.append({
                        'chords': chords,
                        'text': ' '.join(text),
                        'line_type': 'verse' if 'verse' in line.lower() else 'chorus' if 'chorus' in line.lower() else 'normal'
                    })
                else:
                    lyrics.append({
                        'chords': [],
                        'text': line,
                        'line_type': 'normal'
                    })
        
        # 전체 가사를 반환 (프론트에서 페이지네이션/더보기 처리)
        return lyrics
    except Exception as e:
        print(f"Error extracting lyrics: {e}")
        return []

def extract_chord_info_from_description(description: str) -> Dict[str, Any]:
    """설명에서 코드 정보 추출"""
    try:
        lines = description.split('\n')
        chord_progressions = []
        chord_patterns = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 코드 진행 패턴 찾기
            if any(keyword in line.lower() for keyword in ['chord', '코드', 'progression', '진행']):
                # 코드 추출 (Am, F, C, G 등)
                import re
                chords = re.findall(r'\b[A-G][#b]?[m]?[0-9]?[sus]?[0-9]?\b', line)
                if chords:
                    chord_progressions.append({
                        'chords': chords,
                        'context': line[:100]  # 컨텍스트 정보
                    })
        
        # 일반적인 코드 패턴 생성
        common_patterns = [
            ['C', 'Am', 'F', 'G'],
            ['G', 'Em', 'C', 'D'],
            ['D', 'Bm', 'G', 'A'],
            ['A', 'F#m', 'D', 'E'],
            ['E', 'C#m', 'A', 'B']
        ]
        
        return {
            'extracted_progressions': chord_progressions,
            'common_patterns': common_patterns,
            'total_chords_found': len(chord_progressions)
        }
    except Exception as e:
        print(f"Error extracting chord info: {e}")
        return {'extracted_progressions': [], 'common_patterns': [], 'total_chords_found': 0}

def extract_audio_from_youtube(url: str) -> str:
    """YouTube에서 오디오 추출"""
    try:
        # 임시 디렉토리 생성
        temp_dir = tempfile.mkdtemp()
        output_path = os.path.join(temp_dir, "audio.%(ext)s")
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
            'ffmpeg_location': os.path.join(os.path.dirname(__file__), 'ffmpeg-master-latest-win64-gpl', 'bin'),
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
            # 생성된 오디오 파일 찾기
            for file in os.listdir(temp_dir):
                if file.endswith('.wav'):
                    return os.path.join(temp_dir, file)
        
        return None
    except Exception as e:
        print(f"Error extracting audio: {e}")
        return None

def analyze_audio_with_librosa(audio_path: str) -> Dict[str, Any]:
    """Librosa를 사용한 실제 오디오 분석"""
    try:
        # 오디오 로드
        y, sr = librosa.load(audio_path, sr=22050)
        
        # 기본 분석
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        key = estimate_key(y, sr)
        
        # 피치 분석
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.1)
        
        # 코드 분석
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chord_progressions = analyze_chord_progressions(chroma)
        
        # 리듬 분석
        onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)
        
        # 난이도 분석
        difficulty = analyze_difficulty(y, sr, tempo, chroma)
        
        return {
            'tempo': int(tempo),
            'key': key,
            'difficulty': difficulty,
            'chord_progressions': chord_progressions,
            'pitches': pitches.tolist() if pitches is not None else [],
            'onset_times': onset_times.tolist(),
            'chroma': chroma.tolist()
        }
    except Exception as e:
        print(f"Error analyzing audio: {e}")
        return None

def estimate_key(y, sr):
    """키 추정"""
    try:
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        
        # 간단한 키 추정 (C, G, D, A, E, B, F# 등)
        keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F']
        key_scores = []
        
        for i, key in enumerate(keys):
            score = np.sum(chroma_mean * np.roll(chroma_mean, i))
            key_scores.append(score)
        
        best_key_idx = np.argmax(key_scores)
        return keys[best_key_idx]
    except:
        return 'C'

def analyze_chord_progressions(chroma):
    """코드 진행 분석"""
    try:
        # 코드 템플릿 (C, D, E, F, G, A, B)
        chord_templates = {
            'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'D': [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0],
            'E': [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
            'F': [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            'G': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'A': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]
        }
        
        # 시간에 따른 코드 분석
        chord_progressions = []
        frame_length = 100  # 분석할 프레임 길이
        
        for i in range(0, chroma.shape[1] - frame_length, frame_length):
            frame_chroma = np.mean(chroma[:, i:i+frame_length], axis=1)
            
            best_chord = None
            best_score = 0
            
            for chord, template in chord_templates.items():
                score = np.dot(frame_chroma, template)
                if score > best_score:
                    best_score = score
                    best_chord = chord
            
            if best_chord:
                chord_progressions.append({
                    'chord': best_chord,
                    'start_time': i / 10,  # 대략적인 시간
                    'confidence': float(best_score)
                })
        
        return chord_progressions[:20]  # 최대 20개
    except:
        return []

def analyze_difficulty(y, sr, tempo, chroma):
    """난이도 분석"""
    try:
        # 템포 기반 난이도
        tempo_score = min(tempo / 120, 1.0)  # 120 BPM 기준
        
        # 복잡도 분석
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        complexity = np.std(spectral_centroids) / np.mean(spectral_centroids)
        complexity_score = min(complexity, 1.0)
        
        # 코드 변화율
        chord_changes = 0
        for i in range(1, len(chroma[0])):
            if np.any(chroma[:, i] != chroma[:, i-1]):
                chord_changes += 1
        change_rate = chord_changes / len(chroma[0])
        
        # 전체 난이도 점수
        difficulty_score = (tempo_score * 0.4 + complexity_score * 0.3 + change_rate * 0.3)
        
        if difficulty_score < 0.3:
            return "초급"
        elif difficulty_score < 0.6:
            return "중급"
        else:
            return "고급"
    except:
        return "중급"

def generate_tabs_from_analysis(analysis_data, video_info):
    """분석 데이터로부터 타브 생성 (실제 가사와 코드 정보 활용)"""
    try:
        tabs = []
        tempo = analysis_data.get('tempo', 120)
        key = analysis_data.get('key', 'C')
        
        # 가사와 코드 정보 활용
        lyrics = video_info.get('lyrics', [])
        chord_info = video_info.get('chord_info', {})
        
        # 코드 진행 생성
        chord_progressions = generate_chord_progressions_from_lyrics(lyrics, chord_info, tempo)
        
        # 가사 기반 타브 생성
        if lyrics:
            tabs = generate_tabs_from_lyrics(lyrics, chord_progressions, tempo, key)
        else:
            # 기본 타브 생성
            tabs = generate_basic_tabs(tempo, key)
        
        return tabs
    except Exception as e:
        print(f"Error generating tabs: {e}")
        return []

def generate_chord_progressions_from_lyrics(lyrics, chord_info, tempo):
    """가사에서 코드 진행 생성"""
    try:
        progressions = []
        
        # 추출된 코드 진행 사용
        if chord_info.get('extracted_progressions'):
            for prog in chord_info['extracted_progressions']:
                chords = prog['chords']
                for i, chord in enumerate(chords):
                    progressions.append({
                        'chord': chord,
                        'start_time': i * (tempo / 60) * 4,  # 4분음표 기준
                        'duration': (tempo / 60) * 4,
                        'confidence': 0.8
                    })
        else:
            # 가사에서 코드 추출
            for i, line in enumerate(lyrics):
                if line.get('chords'):
                    for j, chord in enumerate(line['chords']):
                        progressions.append({
                            'chord': chord,
                            'start_time': (i * 4 + j) * (tempo / 60) * 4,
                            'duration': (tempo / 60) * 4,
                            'confidence': 0.7
                        })
        
        # 기본 코드 진행이 없으면 생성
        if not progressions:
            basic_chords = ['C', 'Am', 'F', 'G']
            for i, chord in enumerate(basic_chords):
                progressions.append({
                    'chord': chord,
                    'start_time': i * (tempo / 60) * 4,
                    'duration': (tempo / 60) * 4,
                    'confidence': 0.5
                })
        
        return progressions
    except Exception as e:
        print(f"Error generating chord progressions: {e}")
        return []

def generate_tabs_from_lyrics(lyrics, chord_progressions, tempo, key):
    """가사 기반 타브 생성"""
    try:
        tabs = []
        measure = 1
        
        # 코드를 프렛으로 변환하는 매핑
        chord_to_frets = {
            'C': [0, 0, 0, 2, 3, 0],
            'Am': [0, 0, 2, 2, 1, 0],
            'F': [1, 3, 3, 2, 1, 1],
            'G': [3, 2, 0, 0, 0, 3],
            'D': [0, 0, 2, 3, 2, 0],
            'Em': [0, 0, 1, 2, 2, 0],
            'A': [0, 2, 2, 1, 0, 0],
            'E': [0, 0, 0, 1, 2, 0],
            'B': [0, 2, 4, 4, 3, 2]
        }
        
        for line in lyrics:
            if line.get('chords'):
                # 코드가 있는 라인
                for chord in line['chords']:
                    frets = chord_to_frets.get(chord, [0, 0, 0, 0, 0, 0])
                    tabs.append({
                        'measure': measure,
                        'frets': frets,
                        'notes': ['E', 'B', 'G', 'D', 'A', 'E'],
                        'technique': 'strumming',
                        'chord': chord,
                        'lyrics': line.get('text', '')
                    })
                    measure += 1
            else:
                # 코드가 없는 라인 - 멜로디 생성
                tabs.append({
                    'measure': measure,
                    'frets': [0, 0, 0, 0, 0, 0],
                    'notes': ['E', 'B', 'G', 'D', 'A', 'E'],
                    'technique': 'melody',
                    'chord': '',
                    'lyrics': line.get('text', '')
                })
                measure += 1
        
        return tabs[:16]  # 최대 16마디
    except Exception as e:
        print(f"Error generating tabs from lyrics: {e}")
        return []

def generate_basic_tabs(tempo, key):
    """기본 타브 생성"""
    try:
        tabs = []
        basic_patterns = [
            [0, 0, 0, 2, 3, 0],  # C
            [0, 0, 2, 2, 1, 0],  # Am
            [1, 3, 3, 2, 1, 1],  # F
            [3, 2, 0, 0, 0, 3],  # G
        ]
        
        for i in range(8):
            pattern = basic_patterns[i % len(basic_patterns)]
            tabs.append({
                'measure': i + 1,
                'frets': pattern,
                'notes': ['E', 'B', 'G', 'D', 'A', 'E'],
                'technique': 'strumming'
            })
        
        return tabs
    except Exception as e:
        print(f"Error generating basic tabs: {e}")
        return []

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Real Analysis API is running"}

@app.post("/analyze", response_model=Dict[str, Any])
async def analyze_music(request: AnalysisRequest):
    try:
        print(f"Starting analysis for: {request.url}")
        
        # 1. YouTube 정보 가져오기
        video_info = get_youtube_info(request.url)
        if not video_info:
            raise HTTPException(status_code=400, detail="Failed to get YouTube video info")
        
        print(f"Video info: {video_info['title']} by {video_info['uploader']}")
        
        # 2. 오디오 추출
        print("Extracting audio...")
        audio_path = extract_audio_from_youtube(request.url)
        if not audio_path:
            raise HTTPException(status_code=400, detail="Failed to extract audio")
        
        print(f"Audio extracted to: {audio_path}")
        
        # 3. 오디오 분석
        print("Analyzing audio...")
        analysis_data = analyze_audio_with_librosa(audio_path)
        if not analysis_data:
            raise HTTPException(status_code=400, detail="Failed to analyze audio")
        
        print(f"Analysis complete: tempo={analysis_data['tempo']}, key={analysis_data['key']}")
        
        # 4. 타브 생성
        tabs = generate_tabs_from_analysis(analysis_data, video_info)
        
        # 5. 결과 구성
        result = {
            "success": True,
            "data": {
                "title": video_info['title'],
                "artist": video_info['uploader'],
                "duration": video_info['duration'],
                "tempo": analysis_data['tempo'],
                "key": analysis_data['key'],
                "difficulty": analysis_data['difficulty'],
                "tabs": tabs,
                "chord_progressions": analysis_data['chord_progressions'],
                "lyrics": video_info.get('lyrics', []),
                "chord_info": video_info.get('chord_info', {}),
                "metadata": {
                    "view_count": video_info['view_count'],
                    "upload_date": video_info['upload_date'],
                    "tags": video_info['tags'][:5] if video_info['tags'] else [],
                    "analysis_method": "real_audio_analysis",
                    "thumbnail": video_info.get('thumbnail', ''),
                    "video_id": video_info.get('video_id', ''),
                    "lyrics_extracted": len(video_info.get('lyrics', [])) > 0,
                    "chords_extracted": video_info.get('chord_info', {}).get('total_chords_found', 0) > 0
                }
            }
        }
        
        # 6. 임시 파일 정리
        try:
            os.remove(audio_path)
            os.rmdir(os.path.dirname(audio_path))
        except:
            pass
        
        print("Analysis completed successfully!")
        return result
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return {
            "success": False,
            "data": None,
            "error": f"Analysis failed: {str(e)}"
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
