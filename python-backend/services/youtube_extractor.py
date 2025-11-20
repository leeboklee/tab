import os
import tempfile
import asyncio
import logging
from typing import Optional, Dict, Any
import yt_dlp
from pathlib import Path

logger = logging.getLogger(__name__)

class YouTubeExtractor:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix="guitar2tabs_")
        
    async def extract_audio(self, url: str) -> Optional[Dict[str, Any]]:
        """
        유튜브 URL에서 오디오를 추출합니다.
        """
        try:
            # yt-dlp 옵션 설정
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': os.path.join(self.temp_dir, '%(title)s.%(ext)s'),
                'extractaudio': True,
                'audioformat': 'wav',
                'audioquality': '0',  # 최고 품질
                'noplaylist': True,
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 비디오 정보 가져오기
                info = ydl.extract_info(url, download=False)
                
                if not info:
                    logger.error("Failed to extract video info")
                    return None
                
                # 오디오 다운로드
                ydl.download([url])
                
                # 다운로드된 파일 찾기
                downloaded_files = list(Path(self.temp_dir).glob("*.wav"))
                if not downloaded_files:
                    # wav가 없으면 다른 형식 찾기
                    downloaded_files = list(Path(self.temp_dir).glob("*"))
                
                if not downloaded_files:
                    logger.error("No audio file downloaded")
                    return None
                
                audio_file = downloaded_files[0]
                
                return {
                    'audio_path': str(audio_file),
                    'title': info.get('title', 'Unknown'),
                    'artist': info.get('uploader', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'thumbnail': info.get('thumbnail', ''),
                    'description': info.get('description', ''),
                    'view_count': info.get('view_count', 0),
                    'upload_date': info.get('upload_date', ''),
                }
                
        except Exception as e:
            logger.error(f"Error extracting audio: {str(e)}")
            return None
    
    async def cleanup(self, audio_path: str):
        """
        임시 파일을 정리합니다.
        """
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
                logger.info(f"Cleaned up audio file: {audio_path}")
        except Exception as e:
            logger.error(f"Error cleaning up file: {str(e)}")
    
    def __del__(self):
        """
        클래스 소멸 시 임시 디렉토리 정리
        """
        try:
            import shutil
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
        except Exception as e:
            logger.error(f"Error cleaning up temp directory: {str(e)}")

