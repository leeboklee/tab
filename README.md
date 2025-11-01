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
git clone https://github.com/your-username/guitar2tabs.git
cd guitar2tabs
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

# 개발 서버 시작 (포트 3009)
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

# 개발 서버 시작 (포트 8000)
python -m uvicorn main:app --reload --port 8000
```

## 📖 사용법

1. **웹 브라우저에서 `http://localhost:3009` 접속**
2. **유튜브 URL 입력** (예: `https://www.youtube.com/watch?v=...`)
3. **"AI로 타브 악보 생성하기" 버튼 클릭**
4. **분석 완료 후 타브 악보 확인 및 다운로드**

## 🔧 API 사용법

### 분석 요청
```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### 비동기 분석 (대용량 파일용)
```bash
# 분석 시작
curl -X POST "http://localhost:8000/analyze-async" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'

# 상태 확인
curl "http://localhost:8000/status/TASK_ID"
```

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
│   ├── main.py           # FastAPI 메인
│   └── services/         # 서비스 모듈
│       ├── youtube_extractor.py  # 유튜브 추출
│       ├── audio_analyzer.py     # 오디오 분석
│       ├── ai_processor.py       # AI 처리
│       └── tab_generator.py      # 타브 생성
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
1. **포트 충돌**: `docker-compose.yml`에서 포트 변경
2. **의존성 오류**: `npm install` 또는 `pip install -r requirements.txt` 재실행
3. **Docker 오류**: `docker-compose down && docker-compose up -d` 재시작

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

