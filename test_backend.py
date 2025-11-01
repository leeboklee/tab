#!/usr/bin/env python3
"""
백엔드 서버 테스트 스크립트
"""
import requests
import json
import time

def test_backend():
    print("🔍 백엔드 서버 테스트 시작...")
    
    # 1. 헬스 체크
    try:
        print("1. 헬스 체크 테스트...")
        response = requests.get('http://localhost:8002/health', timeout=5)
        print(f"   ✅ 헬스 체크 성공: {response.status_code}")
        print(f"   📄 응답: {response.json()}")
    except Exception as e:
        print(f"   ❌ 헬스 체크 실패: {e}")
        return False
    
    # 2. 실제 오디오 분석 테스트
    try:
        print("\n2. 실제 오디오 분석 테스트...")
        test_url = "https://youtu.be/dQw4w9WgXcQ"  # Rick Roll (짧은 곡)
        
        payload = {
            "url": test_url,
            "analysis_type": "real"
        }
        
        print(f"   🎵 분석 URL: {test_url}")
        print("   ⏳ 분석 중... (최대 30초 대기)")
        
        response = requests.post(
            'http://localhost:8002/analyze-audio',
            json=payload,
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ 분석 성공!")
            print(f"   📊 제목: {result.get('data', {}).get('title', 'N/A')}")
            print(f"   🎼 템포: {result.get('data', {}).get('tempo', 'N/A')}")
            print(f"   🎹 키: {result.get('data', {}).get('key', 'N/A')}")
            
            # 타브 데이터 확인
            tabs = result.get('data', {}).get('tabs', [])
            if tabs:
                print(f"   🎸 타브 마디 수: {len(tabs)}")
                print("   📝 첫 번째 마디 타브:")
                for i, tab in enumerate(tabs[:2]):  # 처음 2마디만 출력
                    frets = tab.get('frets', [])
                    print(f"      마디 {i+1}: {frets}")
                
                # 실제 프렛 숫자가 있는지 확인
                has_real_frets = any(
                    any(fret > 0 for fret in tab.get('frets', []))
                    for tab in tabs
                )
                
                if has_real_frets:
                    print("   ✅ 실제 프렛 데이터가 생성되었습니다!")
                    return True
                else:
                    print("   ⚠️  프렛 데이터가 모두 0입니다.")
                    return False
            else:
                print("   ❌ 타브 데이터가 없습니다.")
                return False
        else:
            print(f"   ❌ 분석 실패: {response.status_code}")
            print(f"   📄 응답: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ 분석 테스트 실패: {e}")
        return False

if __name__ == "__main__":
    success = test_backend()
    if success:
        print("\n🎉 백엔드 테스트 성공! 실제 타브가 생성됩니다.")
    else:
        print("\n💥 백엔드 테스트 실패. 문제를 확인해주세요.")
