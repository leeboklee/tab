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

# 기본 의존성 설치 (yt-dlp + librosa 폴백 채보, torch 불필요)
pip install -r requirements.txt

# 고품질 모드까지 원하면 추가 설치 (Basic Pitch 다성 채보 + Demucs 스템 분리)
pip install -r requirements-hq.txt

# 분석 서버 시작 (포트 8002)
python -m app.main
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

### WSL 선행 조건
```bash
sudo apt update
sudo apt install -y python3-venv python3-pip
```
- WSL 기본 Python에 pip/venv가 없으면 백엔드 의존성 설치가 실패함
- 프론트만 확인할 때는 `npm ci && npm run build && npm run dev:frontend`로 충분

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
├── components/            # React 컴포넌트 (실사용 컴포넌트는 전부 여기)
│   ├── YouTubePlayer.tsx  # 유튜브 플레이어
│   ├── TabViewer.tsx      # 타브 뷰어
│   └── LoadingSpinner.tsx # 로딩 스피너
├── python-backend/        # Python 백엔드 (단일 진입점으로 통합됨)
│   ├── app/
│   │   ├── main.py               # FastAPI 앱 (유일한 진입점)
│   │   ├── config.py             # 환경변수 기반 설정
│   │   ├── schemas.py            # 요청/응답 모델
│   │   └── pipeline/
│   │       ├── youtube.py        # 유튜브 추출 (yt-dlp)
│   │       ├── separation.py     # 기타 스템 분리 (Demucs, 선택)
│   │       ├── transcription.py  # 다성 채보 (Basic Pitch, 없으면 librosa 폴백)
│   │       ├── features.py       # 템포/조성/코드 추출 (librosa)
│   │       ├── fretboard.py      # MIDI -> 지판 운지 최적화 (비터비 DP)
│   │       ├── tab.py            # 노트 -> 마디 단위 타브 조립
│   │       ├── export.py         # MIDI/MusicXML 내보내기
│   │       └── analyzer.py       # 위 단계들을 잇는 오케스트레이터
│   ├── tests/                    # pytest 단위 테스트
│   ├── requirements.txt          # 기본 의존성 (torch 없이 동작)
│   ├── requirements-hq.txt       # 고품질 모드: Basic Pitch + Demucs
│   └── requirements-dev.txt      # 테스트용
├── scripts/
│   └── smoke-real-analysis.ps1   # 회귀 스모크 테스트
├── docker-compose.yml     # Docker 설정
├── Dockerfile.frontend    # 프론트엔드 Docker
└── README.md             # 프로젝트 문서
```

### 분석 파이프라인 (`python-backend/app/pipeline`)

```
유튜브 URL
  → youtube.py       yt-dlp로 오디오 추출 (여러 클라이언트 전략을 순차 시도)
  → separation.py    Demucs로 기타 스템만 분리 (quality=high, 선택적)
  → transcription.py Basic Pitch로 다성 채보 (미설치 시 librosa CQT 폴백)
  → features.py      템포/비트/조성/코드 진행 추출 (librosa)
  → fretboard.py      MIDI 노트를 지판 위치로 배치 — 프레임별 후보 운지(Shape)를
                       만들고 손 이동 비용까지 포함한 비터비 최단경로로 선택
  → tab.py           비트 격자에 양자화 후 마디 단위로 조립, 기법(해머온/바레 등) 태깅
  → export.py        MIDI(pretty_midi) / MusicXML(music21) 내보내기
```

이전 구현(`real_analysis_main.py`)은 단선율 피치 추적(`librosa.yin`)으로 슬롯당
음 하나만 뽑고, 운지도 직전 위치를 고려하지 않는 `min()` 그리디였다. 기타는
화음 악기이고 손은 한 번에 한 곳에만 있을 수 있으므로 그 방식으로는 근본적으로
정확한 타브가 나올 수 없었다. 지금은 다성 채보 + DP 기반 운지 최적화로 교체했다.

### 품질 모드
- `fast`: 분리 없이 원본을 그대로 채보 (가장 빠름)
- `balanced` (기본값): 가능하면 Demucs로 기타 스템 분리 후 채보
- `high`: 분리 필수 + 채보 임계값을 낮춰 약한 소리까지 포착 (가장 느림, 가장 정확)

`requirements-hq.txt`를 설치하지 않아도 서버는 정상 동작하며, `librosa` 폴백
채보로 자동 전환된다. `/health`, `/capabilities` 엔드포인트에서 현재 어떤
엔진이 켜져 있는지 확인할 수 있다.

## 🛠️ 개발 가이드

### 새로운 기능 추가
1. **프론트엔드**: `components/` 디렉토리에 새 컴포넌트 추가
2. **백엔드**: `python-backend/app/pipeline/` 디렉토리에 새 파이프라인 단계 추가
3. **API**: `python-backend/app/main.py`에 새 엔드포인트 추가

### 채보/타브 정확도 개선
1. **채보 엔진 교체**: `python-backend/app/pipeline/transcription.py` 수정
2. **운지 최적화 튜닝**: `python-backend/app/pipeline/fretboard.py`의 비용 함수 조정
3. **테스트**: `cd python-backend && python -m pytest tests/ -q`로 회귀 확인

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

