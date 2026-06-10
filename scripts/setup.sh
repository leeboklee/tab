#!/bin/bash

# Guitar2Tabs 설정 스크립트

echo "🎸 Guitar2Tabs 설정을 시작합니다..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Node.js 버전 확인
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js 설치됨: $NODE_VERSION"
    else
        print_error "Node.js가 설치되지 않았습니다. https://nodejs.org/ 에서 설치하세요."
        exit 1
    fi
}

# Python 버전 확인
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python 설치됨: $PYTHON_VERSION"
    else
        print_error "Python3가 설치되지 않았습니다. https://python.org/ 에서 설치하세요."
        exit 1
    fi
}

# Docker 확인
check_docker() {
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker 설치됨: $DOCKER_VERSION"
    else
        print_warning "Docker가 설치되지 않았습니다. Docker를 사용하려면 https://docker.com/ 에서 설치하세요."
    fi
}

# 프론트엔드 설정
setup_frontend() {
    print_status "프론트엔드 의존성을 설치합니다..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json 파일을 찾을 수 없습니다."
        exit 1
    fi
    
    npm install
    if [ $? -eq 0 ]; then
        print_success "프론트엔드 의존성 설치 완료"
    else
        print_error "프론트엔드 의존성 설치 실패"
        exit 1
    fi
}

# Python 백엔드 설정
setup_backend() {
    print_status "Python 백엔드 설정을 시작합니다..."
    
    cd python-backend
    
    # 가상환경 생성
    if [ ! -d "venv" ]; then
        print_status "Python 가상환경을 생성합니다..."
        python3 -m venv venv
    fi
    
    # 가상환경 활성화
    source venv/bin/activate
    
    # 의존성 설치
    print_status "Python 의존성을 설치합니다..."
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        print_success "Python 백엔드 설정 완료"
    else
        print_error "Python 백엔드 설정 실패"
        exit 1
    fi
    
    cd ..
}

# 환경 변수 설정
setup_env() {
    print_status "환경 변수를 설정합니다..."
    
    if [ ! -f ".env.local" ]; then
        cat > .env.local << EOF
# Guitar2Tabs 환경 변수
NEXT_PUBLIC_REAL_AUDIO_API_BASE=http://localhost:8002
REAL_AUDIO_API_BASE=http://localhost:8002
# YTDLP_COOKIE_FILE=/path/to/cookies.txt
# YTDLP_COOKIES_FROM_BROWSER=chrome
NODE_ENV=development
EOF
        print_success ".env.local 파일이 생성되었습니다."
    else
        print_warning ".env.local 파일이 이미 존재합니다."
    fi
}

# Docker 설정
setup_docker() {
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        print_status "Docker 컨테이너를 빌드합니다..."
        docker-compose build
        
        if [ $? -eq 0 ]; then
            print_success "Docker 빌드 완료"
        else
            print_error "Docker 빌드 실패"
            exit 1
        fi
    else
        print_warning "Docker가 설치되지 않아 Docker 설정을 건너뜁니다."
    fi
}

# 메인 실행
main() {
    echo "🎸 Guitar2Tabs 설정 스크립트"
    echo "================================"
    
    # 필수 도구 확인
    check_node
    check_python
    check_docker
    
    # 설정 실행
    setup_frontend
    setup_backend
    setup_env
    setup_docker
    
    echo ""
    echo "🎉 설정이 완료되었습니다!"
    echo ""
    echo "다음 명령어로 서비스를 시작할 수 있습니다:"
    echo ""
    echo "📦 Docker 사용 (권장):"
    echo "  docker-compose up -d"
    echo ""
    echo "🔧 로컬 개발:"
    echo "  # 터미널 1: 프론트엔드"
    echo "  npm run dev"
    echo ""
    echo "  # 터미널 2: 백엔드"
    echo "  cd python-backend"
    echo "  source venv/bin/activate"
    echo "  python -m uvicorn main:app --reload --port 8000"
    echo ""
    echo "🌐 브라우저에서 http://localhost:3009 접속"
    echo ""
}

# 스크립트 실행
main "$@"
