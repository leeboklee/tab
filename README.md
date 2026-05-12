# 🎸 Guitar2Tabs - AI 기반 유튜브 음악 분석 서비스

유튜브 URL을 입력하면 AI가 자동으로 기타 타브 악보를 생성해주는 혁신적인 서비스입니다.

## ✨ 주요 기능

- **🎵 유튜브 음악 분석**: URL만 입력하면 자동으로 오디오 추출 및 분석
- **🤖 AI 기반 타브 생성**: 머신러닝을 활용한 정확한 기타 타브 악보 생성
- **📊 실시간 미리보기**: 웹에서 바로 타브 악보 확인 및 편집
- **💾 다양한 형식 지원**: PDF, MusicXML, GPX, JSON 등으로 다운로드
- **🎯 난이도 분석**: 초급, 중급, 고급 난이도 자동 분류
- **🔧 연주 기법 식별**: 바레 코드, 하이 프렛 등 연주 기법 자동 감지

## 🏗️ 기술 스택

### 프론트엔드
- **Next.js 14** - React 기반 풀스택 프레임워크
- **TypeScript** - 타입 안정성
- **Tailwind CSS** - 모던 UI/UX
- **Framer Motion** - 애니메이션

### 백엔드 & AI
- **Python 3.11** - 오디오 분석 및 AI 처리
- **FastAPI** - 고성능 Python API 서버
- **Librosa** - 오디오 신호 처리
- **TensorFlow/PyTorch** - AI 모델
- **yt-dlp** - 유튜브 오디오 추출

### 인프라
- **Docker** - 컨테이너화
- **PostgreSQL** - 데이터베이스
- **Redis** - 캐싱
- **Nginx** - 리버스 프록시

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone https://github.com/leeboklee/tab.git
cd tab
cp .env.example .env.local
```

### 2. Docker로 실행 (권장)
```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 3. 로컬 개발 환경

#### 프론트엔드 실행
```bash
# 의존성 설치
npm install

# 프론트 + 실제 분석 서버 시작
npm run dev
```

#### Python 백엔드 실행
```bash
cd python-backend

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 실제 분석 서버 시작 (포트 8002)
python real_analysis_main.py
```

## 📖 사용법

1. **웹 브라우저에서 `http://localhost:3019` 접속**
2. **유튜브 URL 입력** (예: `https://www.youtube.com/watch?v=...`)
3. **"분석 시작" 버튼 클릭**
4. **결과가 `실제 오디오 분석 성공 / 추출 후 메타데이터 폴백 / 미리보기 분석` 중 어떤 상태인지 확인**
5. **분석 완료 후 타브 악보 확인 및 다운로드**

## 🔧 API 사용법

### 실제 분석 요청
```bash
curl -X POST "http://localhost:8002/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### 음원 추출만 먼저 수행 (추출/분석 분리)
```bash
curl -X POST "http://localhost:8002/extract-audio" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### 저장된 음원으로 탭 생성
```bash
curl -X POST "http://localhost:8002/analyze-from-audio" \
  -H "Content-Type: application/json" \
  -d '{"audio_id": "AUDIO_ID"}'
```

### 헬스체크
```bash
curl "http://localhost:8002/health"
```

### 회귀 스모크 테스트
```bash
npm run test:smoke:analysis
```

### 백엔드 안전 기동
```bash
npm run dev:backend
```
- 이미 `8002`에서 정상 서버가 돌고 있으면 재기동하지 않고 재사용
- `8002`가 죽은 프로세스로 점유된 상태면 PID를 알려주고 중지

## 운영 메모

### 환경 변수
- 새 클론에서는 `.env.example`을 `.env.local`로 복사한 뒤 로컬 경로만 조정
- 실제 쿠키 파일, 토큰, DB URL 같은 비밀값은 커밋 금지
- `NEXT_PUBLIC_REAL_AUDIO_API_BASE`: 프론트가 호출할 실제 분석 서버 주소. 기본값 `http://localhost:8002`
- `REAL_AUDIO_API_BASE`: CLI 테스트와 스모크 테스트가 호출할 실제 분석 서버 주소. 기본값 `http://localhost:8002`
- `YTDLP_COOKIE_FILE`: 제한 영상 대응용 Netscape 형식 쿠키 파일 경로
- `YTDLP_COOKIES_FROM_BROWSER`: 브라우저 쿠키 직접 읽기 설정. 예: `chrome`, `edge:Default`

### 클론/환경 이관 체크
```bash
git clone https://github.com/leeboklee/tab.git
cd tab
cp .env.example .env.local
npm install
npm run python:install
npm run dev
```
- Windows PowerShell에서는 `Copy-Item .env.example .env.local` 사용
- 제한 영상 분석이 필요하면 `.env.local`에 `YTDLP_COOKIE_FILE` 또는 `YTDLP_COOKIES_FROM_BROWSER`만 추가
- 이관 후 `npm run test:smoke:analysis`로 실제 분석 서버 응답 확인

### D드라이브 작업 폴더 삭제 기준
- `git status --short --branch`가 `main...origin/main`만 보여야 함
- `git ls-files --others --exclude-standard` 결과가 비어 있어야 함
- 새 클론에서 `.env.example`을 `.env.local`로 복사할 수 있어야 함
- `.next`, `node_modules`, `python-backend/storage`, 로그, 테스트 결과, FFmpeg 압축 해제 폴더는 재생성 가능한 로컬 산출물이므로 Git에 올리지 않음
- 저장된 오디오 파일이나 쿠키 파일을 보존해야 하면 삭제 전에 별도 백업

### 상태 해석
- `audio_verified`: 실제 음원 추출과 파형 분석 성공
- `metadata_fallback`: 추출 성공 후 오디오 분석 단계에서 폴백
- `preview_only`: 서버 미연결 또는 실패 후 미리보기 결과

## 🎯 AI 기능

### 음악 분석
- **템포 감지**: BPM 자동 계산
- **키/모드 분석**: 조성 자동 판별
- **피치 추출**: CREPE 모델 활용
- **리듬 분석**: 온셋 검출 및 패턴 분류
- **코드 진행**: 하모니 분석

### 타브 생성
- **프렛 매핑**: 주파수를 기타 프렛으로 변환
- **연주 가능성 검증**: 실제 연주 가능한 타브 생성
- **난이도 평가**: 초급/중급/고급 자동 분류
- **기법 식별**: 바레 코드, 하이 프렛 등 감지

## 📁 프로젝트 구조

```
guitar2tabs/
├── app/                    # Next.js 앱 디렉토리
│   ├── globals.css        # 글로벌 스타일
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 메인 페이지
├── components/            # React 컴포넌트
│   ├── YouTubePlayer.tsx  # 유튜브 플레이어
│   ├── TabViewer.tsx      # 타브 뷰어
│   └── LoadingSpinner.tsx # 로딩 스피너
├── python-backend/        # Python 백엔드
│   ├── real_analysis_main.py  # 실제 분석 API 메인
│   └── services/         # 서비스 모듈
│       ├── audio_pipeline.py     # 유튜브 추출/저장 파이프라인
│       ├── youtube_extractor.py  # 레거시 추출기
│       ├── audio_analyzer.py     # 레거시 분석기
│       └── tab_generator.py      # 타브 생성
├── scripts/
│   └── smoke-real-analysis.ps1   # 회귀 스모크 테스트
├── docker-compose.yml     # Docker 설정
├── Dockerfile.frontend    # 프론트엔드 Docker
└── README.md             # 프로젝트 문서
```

## 🛠️ 개발 가이드

### 새로운 기능 추가
1. **프론트엔드**: `components/` 디렉토리에 새 컴포넌트 추가
2. **백엔드**: `python-backend/services/` 디렉토리에 새 서비스 추가
3. **API**: `python-backend/main.py`에 새 엔드포인트 추가

### AI 모델 개선
1. **새 모델 추가**: `python-backend/services/ai_processor.py` 수정
2. **성능 최적화**: `python-backend/services/audio_analyzer.py` 개선
3. **정확도 향상**: 더 많은 훈련 데이터와 하이퍼파라미터 튜닝

## 🐛 문제 해결

### 일반적인 문제
1. **포트 충돌**: `3019`, `8002` 점유 프로세스를 먼저 정리
2. **의존성 오류**: `npm install` 또는 `pip install -r requirements.txt` 재실행
3. **분석 실패**: `http://localhost:8002/health`에서 `ffmpeg_available`, `librosa` 상태 확인
4. **제한 영상 실패**: `YTDLP_COOKIE_FILE` 또는 `YTDLP_COOKIES_FROM_BROWSER` 설정

### 로그 확인
```bash
# 모든 서비스 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs frontend
docker-compose logs backend
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

- **이슈 리포트**: [GitHub Issues](https://github.com/your-username/guitar2tabs/issues)
- **이메일**: support@guitar2tabs.com
- **문서**: [Wiki](https://github.com/your-username/guitar2tabs/wiki)

## 🙏 감사의 말

- [Librosa](https://librosa.org/) - 오디오 분석 라이브러리
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 유튜브 다운로더
- [Next.js](https://nextjs.org/) - React 프레임워크
- [FastAPI](https://fastapi.tiangolo.com/) - Python 웹 프레임워크

---

**Guitar2Tabs**로 음악을 더 쉽게 배워보세요! 🎸✨

