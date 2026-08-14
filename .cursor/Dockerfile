# Guitar2Tabs Cloud Agent base image.
# Node 22 for the Next.js frontend + Python 3.11 (Debian bookworm default) for
# the FastAPI real-analysis backend, plus ffmpeg for yt-dlp/librosa audio work.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-venv \
        python3.11-dev \
        python3-pip \
        build-essential \
        ffmpeg \
        git \
        curl \
        ca-certificates \
        lsof \
    && rm -rf /var/lib/apt/lists/*

USER node
