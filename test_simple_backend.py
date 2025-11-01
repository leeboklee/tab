#!/usr/bin/env python3
"""
간단한 백엔드 테스트
"""
import requests
import json

def test_simple():
    print("🔍 간단한 백엔드 테스트...")
    
    try:
        # 헬스 체크
        print("1. 헬스 체크...")
        response = requests.get('http://localhost:8002/health', timeout=5)
        print(f"   ✅ 성공: {response.json()}")
        
        # 실제 오디오 분석
        print("2. 실제 오디오 분석...")
        payload = {
            "url": "https://youtu.be/dQw4w9WgXcQ",
            "analysis_type": "full"
        }
        
        print("   ⏳ 분석 중... (60초 대기)")
        response = requests.post(
            'http://localhost:8002/analyze-audio',
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            print("   ✅ 분석 성공!")
            
            if result.get('success') and result.get('data'):
                data = result['data']
                tabs = data.get('tabs', [])
                print(f"   🎸 타브 마디 수: {len(tabs)}")
                
                if len(tabs) > 0:
                    print("   📝 첫 3마디 타브:")
                    for i, tab in enumerate(tabs[:3]):
                        print(f"      마디 {i+1}: {tab.get('frets', 'N/A')}")
                    
                    if len(tabs) >= 10:
                        print("   ✅ 충분한 마디 수가 생성되었습니다!")
                    else:
                        print("   ⚠️ 마디 수가 부족합니다.")
                else:
                    print("   ❌ 타브 데이터가 없습니다.")
            else:
                print("   ❌ 분석 실패")
        else:
            print(f"   ❌ HTTP 오류: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ 오류: {e}")

if __name__ == "__main__":
    test_simple()
