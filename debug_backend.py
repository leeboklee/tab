#!/usr/bin/env python3
"""
백엔드 응답 구조 디버깅
"""
import requests
import json

def debug_backend_response():
    print("🔍 백엔드 응답 구조 디버깅...")
    
    try:
        # 실제 오디오 분석 요청
        payload = {
            "url": "https://youtu.be/dQw4w9WgXcQ",
            "analysis_type": "full"
        }
        
        print("📤 요청 전송 중...")
        response = requests.post(
            'http://localhost:8002/analyze-audio',
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 응답 성공!")
            print(f"📊 응답 구조:")
            print(f"  - success: {result.get('success')}")
            print(f"  - data 존재: {'data' in result}")
            
            if 'data' in result:
                data = result['data']
                print(f"  - title: {data.get('title')}")
                print(f"  - tempo: {data.get('tempo')}")
                print(f"  - key: {data.get('key')}")
                print(f"  - tabs 타입: {type(data.get('tabs'))}")
                print(f"  - tabs 길이: {len(data.get('tabs', []))}")
                
                # 타브 데이터 상세 확인
                tabs = data.get('tabs', [])
                if tabs:
                    print(f"  - 첫 번째 타브: {tabs[0]}")
                    print(f"  - 타브 구조:")
                    for i, tab in enumerate(tabs[:3]):  # 처음 3개만
                        print(f"    마디 {i+1}: {tab}")
                else:
                    print("  - ❌ 타브 데이터가 없습니다!")
                
                # 코드 진행 확인
                chord_prog = data.get('chord_progression', [])
                print(f"  - 코드 진행 길이: {len(chord_prog)}")
                if chord_prog:
                    print(f"  - 첫 번째 코드: {chord_prog[0]}")
            else:
                print("  - ❌ data 필드가 없습니다!")
                
        else:
            print(f"❌ 응답 실패: {response.status_code}")
            print(f"응답 내용: {response.text}")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    debug_backend_response()
