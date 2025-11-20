# Guitar2Tabs 설정 스크립트 (Windows PowerShell)

Write-Host "🎸 Guitar2Tabs 설정을 시작합니다..." -ForegroundColor Blue

# 함수 정의
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Node.js 버전 확인
function Test-Node {
    try {
        $nodeVersion = node --version
        Write-Success "Node.js 설치됨: $nodeVersion"
        return $true
    }
    catch {
        Write-Error "Node.js가 설치되지 않았습니다. https://nodejs.org/ 에서 설치하세요."
        return $false
    }
}

# Python 버전 확인
function Test-Python {
    try {
        $pythonVersion = python --version
        Write-Success "Python 설치됨: $pythonVersion"
        return $true
    }
    catch {
        Write-Error "Python이 설치되지 않았습니다. https://python.org/ 에서 설치하세요."
        return $false
    }
}

# Docker 확인
function Test-Docker {
    try {
        $dockerVersion = docker --version
        Write-Success "Docker 설치됨: $dockerVersion"
        return $true
    }
    catch {
        Write-Warning "Docker가 설치되지 않았습니다. Docker를 사용하려면 https://docker.com/ 에서 설치하세요."
        return $false
    }
}

# 프론트엔드 설정
function Setup-Frontend {
    Write-Status "프론트엔드 의존성을 설치합니다..."
    
    if (-not (Test-Path "package.json")) {
        Write-Error "package.json 파일을 찾을 수 없습니다."
        exit 1
    }
    
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "프론트엔드 의존성 설치 완료"
    }
    else {
        Write-Error "프론트엔드 의존성 설치 실패"
        exit 1
    }
}

# Python 백엔드 설정
function Setup-Backend {
    Write-Status "Python 백엔드 설정을 시작합니다..."
    
    Set-Location python-backend
    
    # 가상환경 생성
    if (-not (Test-Path "venv")) {
        Write-Status "Python 가상환경을 생성합니다..."
        python -m venv venv
    }
    
    # 가상환경 활성화
    & ".\venv\Scripts\Activate.ps1"
    
    # 의존성 설치
    Write-Status "Python 의존성을 설치합니다..."
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Python 백엔드 설정 완료"
    }
    else {
        Write-Error "Python 백엔드 설정 실패"
        exit 1
    }
    
    Set-Location ..
}

# 환경 변수 설정
function Setup-Environment {
    Write-Status "환경 변수를 설정합니다..."
    
    if (-not (Test-Path ".env.local")) {
        @"
# Guitar2Tabs 환경 변수
NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=postgresql://guitar2tabs:password@localhost:5432/guitar2tabs
REDIS_URL=redis://localhost:6379
NODE_ENV=development
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
        Write-Success ".env.local 파일이 생성되었습니다."
    }
    else {
        Write-Warning ".env.local 파일이 이미 존재합니다."
    }
}

# Docker 설정
function Setup-Docker {
    if ((Test-Docker) -and (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Status "Docker 컨테이너를 빌드합니다..."
        docker-compose build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker 빌드 완료"
        }
        else {
            Write-Error "Docker 빌드 실패"
            exit 1
        }
    }
    else {
        Write-Warning "Docker가 설치되지 않아 Docker 설정을 건너뜁니다."
    }
}

# 메인 실행
function Main {
    Write-Host "🎸 Guitar2Tabs 설정 스크립트" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    # 필수 도구 확인
    $nodeOk = Test-Node
    $pythonOk = Test-Python
    $dockerOk = Test-Docker
    
    if (-not $nodeOk -or -not $pythonOk) {
        Write-Error "필수 도구가 설치되지 않았습니다."
        exit 1
    }
    
    # 설정 실행
    Setup-Frontend
    Setup-Backend
    Setup-Environment
    Setup-Docker
    
    Write-Host ""
    Write-Host "🎉 설정이 완료되었습니다!" -ForegroundColor Green
    Write-Host ""
    Write-Host "다음 명령어로 서비스를 시작할 수 있습니다:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📦 Docker 사용 (권장):" -ForegroundColor Cyan
    Write-Host "  docker-compose up -d" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 로컬 개발:" -ForegroundColor Cyan
    Write-Host "  # 터미널 1: 프론트엔드" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "  # 터미널 2: 백엔드" -ForegroundColor White
    Write-Host "  cd python-backend" -ForegroundColor White
    Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  python -m uvicorn main:app --reload --port 8000" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 브라우저에서 http://localhost:3009 접속" -ForegroundColor Green
    Write-Host ""
}

# 스크립트 실행
Main

