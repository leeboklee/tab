FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# 고품질 모드(Basic Pitch + Demucs)가 필요하면 빌드 시 --build-arg INSTALL_HQ=1
ARG INSTALL_HQ=0
COPY requirements-hq.txt .
RUN if [ "$INSTALL_HQ" = "1" ]; then pip install --no-cache-dir -r requirements-hq.txt; fi

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 8002

# 애플리케이션 실행
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]

