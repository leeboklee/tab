import requests
import json

# 실제 오디오 분석 서버 테스트
url = "http://localhost:8002/analyze-audio"
data = {
    "url": "https://youtu.be/8Q2SrN6J8uc?si=jDixxt4FuOfFvsmi",
    "analysis_type": "full"
}

print("실제 오디오 분석 서버 테스트 시작...")
print(f"URL: {url}")
print(f"Data: {json.dumps(data, indent=2)}")

try:
    response = requests.post(url, json=data, timeout=30)
    print(f"응답 상태 코드: {response.status_code}")
    print(f"응답 헤더: {dict(response.headers)}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ 성공!")
        print(f"응답 데이터: {json.dumps(result, indent=2, ensure_ascii=False)}")
    else:
        print("❌ 실패!")
        print(f"응답 내용: {response.text}")
        
except requests.exceptions.Timeout:
    print("❌ 타임아웃 발생!")
except requests.exceptions.ConnectionError:
    print("❌ 연결 오류!")
except Exception as e:
    print(f"❌ 오류 발생: {e}")
