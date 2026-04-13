import os
import sys

import requests

# 실제 분석 API(real_analysis_main.py, 기본 포트 8002)와 맞춤
BASE_URL = os.environ.get("REAL_AUDIO_API_BASE", "http://localhost:8002").rstrip("/")


def test_health():
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Health check: {response.status_code}")
        print(response.json())
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False


def test_extract_audio():
    """POST /extract-audio — 응답 필드는 data 안에 있음 (audio_id, title, duration 등)."""
    data = {"url": "https://www.youtube.com/watch?v=kQuxJbP6s8Y"}
    print("Extracting audio...")
    try:
        response = requests.post(
            f"{BASE_URL}/extract-audio",
            json=data,
            timeout=120,
        )
        print(f"extract-audio: {response.status_code}")
        payload = response.json()
        if not payload.get("success"):
            print(f"실패: {payload.get('error', payload)}")
            return
        inner = payload.get("data") or {}
        print(f"audio_id: {inner.get('audio_id')}")
        print(f"title: {inner.get('title')}")
        print(f"duration: {inner.get('duration')}s")
        print(f"audio_path: {inner.get('audio_path')}")
    except Exception as e:
        print(f"extract-audio failed: {e}")


def test_analyze():
    """POST /analyze — 추출 + 분석 한 번에."""
    data = {"url": "https://www.youtube.com/watch?v=kQuxJbP6s8Y"}
    print("Full analyze...")
    try:
        response = requests.post(
            f"{BASE_URL}/analyze",
            json=data,
            timeout=180,
        )
        print(f"analyze: {response.status_code}")
        payload = response.json()
        if not payload.get("success"):
            print(f"실패: {payload.get('error', payload)}")
            return
        inner = payload.get("data") or {}
        meta = inner.get("metadata") or {}
        print(f"title: {inner.get('title')}")
        print(f"tempo: {inner.get('tempo')}  key: {inner.get('key')}")
        print(f"result_mode: {meta.get('result_mode')}  method: {meta.get('analysis_method')}")
    except requests.exceptions.Timeout:
        print("타임아웃: 분석이 너무 오래 걸립니다")
    except Exception as e:
        print(f"analyze failed: {e}")


if __name__ == "__main__":
    print(f"=== 서버 테스트 (BASE_URL={BASE_URL}) ===\n")

    if not test_health():
        print("서버가 실행되지 않았습니다. python-backend 에서: python real_analysis_main.py")
        sys.exit(1)

    print("\n=== 음원 추출만 ===")
    test_extract_audio()

    print("\n=== 전체 분석(시간 오래 걸릴 수 있음) ===")
    if os.environ.get("SKIP_ANALYZE"):
        print("SKIP_ANALYZE=1 이므로 건너뜀")
    else:
        test_analyze()

    print("\n=== 테스트 완료 ===")
