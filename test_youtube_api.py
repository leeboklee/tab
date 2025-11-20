import requests
import json

# API 엔드포인트 테스트
BASE_URL = "http://localhost:8001"

def test_health():
    """서버 상태 확인"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health check: {response.status_code}")
        print(response.json())
        return True
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_sample_audio():
    """샘플 오디오 분석 테스트"""
    try:
        response = requests.post(f"{BASE_URL}/analyze-sample-audio")
        print(f"Sample audio analysis: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("성공!"            print(f"템포: {result['data']['tempo']:.2f} BPM")
            print(f"키: {result['data']['key']}")
            print(f"난이도: {result['data']['difficulty']}")
            print(f"코드 진행 수: {len(result['data']['chord_progression'])}")
            print(f"탭 마디 수: {len(result['data']['tabs'])}")
        else:
            print(f"실패: {response.text}")
    except Exception as e:
        print(f"Sample audio test failed: {e}")

def test_youtube_analysis():
    """실제 YouTube 분석 테스트"""
    try:
        data = {
            "url": "https://youtu.be/kQuxJbP6s8Y?si=05CIHlaApP6s8YTI",
            "analysis_type": "full"
        }

        print("YouTube 분석 시작...")
        response = requests.post(f"{BASE_URL}/analyze-audio",
                               json=data,
                               timeout=120)  # 2분 타임아웃

        print(f"YouTube analysis: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            if result['success']:
                print("성공!")
                print(f"처리 시간: {result['processing_time']:.2f}초")
                analysis_data = result['data']

                print(f"템포: {analysis_data['tempo']:.2f} BPM")
                print(f"키: {analysis_data['key']}")
                print(f"난이도: {analysis_data['difficulty']}")
                print(f"지속시간: {analysis_data['duration']:.1f}초")
                print(f"코드 진행 수: {len(analysis_data['chord_progression'])}")
                print(f"탭 마디 수: {len(analysis_data['tabs'])}")
            else:
                print(f"분석 실패: {result['error']}")
        else:
            print(f"요청 실패: {response.text}")

    except requests.exceptions.Timeout:
        print("타임아웃: 분석이 너무 오래 걸립니다")
    except Exception as e:
        print(f"YouTube analysis test failed: {e}")

if __name__ == "__main__":
    print("=== 서버 테스트 시작 ===")

    # 1. 헬스 체크
    if not test_health():
        print("서버가 실행되지 않고 있습니다.")
        exit(1)

    # 2. 샘플 오디오 테스트
    print("\n=== 샘플 오디오 분석 테스트 ===")
    test_sample_audio()

    # 3. YouTube 분석 테스트
    print("\n=== YouTube 분석 테스트 ===")
    test_youtube_analysis()

    print("\n=== 테스트 완료 ===")
