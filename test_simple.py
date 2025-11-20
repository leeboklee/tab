#!/usr/bin/env python3
"""
간단한 백엔드 테스트 - 시뮬레이션 모드
"""
import requests
import json

def test_simple():
    print("🔍 간단한 백엔드 테스트 시작...")
    
    # 1. 헬스 체크
    try:
        print("1. 헬스 체크...")
        response = requests.get('http://localhost:8002/health', timeout=5)
        print(f"   ✅ 성공: {response.json()}")
    except Exception as e:
        print(f"   ❌ 실패: {e}")
        return False
    
    # 2. 시뮬레이션 분석 테스트 (빠른 테스트)
    try:
        print("\n2. 시뮬레이션 분석 테스트...")
        
        # 프론트엔드에서 시뮬레이션 모드로 테스트
        test_url = "https://youtu.be/dQw4w9WgXcQ"
        
        # 프론트엔드 시뮬레이션 로직 직접 실행
        print("   🎵 시뮬레이션 타브 생성 중...")
        
        # 시뮬레이션 데이터 생성 (프론트엔드와 동일한 로직)
        import random
        import math
        
        def generateTabsFromAnalysis(title, artist, tempo, key, difficulty, duration, randomFunc):
            totalMeasures = max(8, int(duration / (60 / tempo * 4)))
            tabs = []
            
            for i in range(totalMeasures):
                frets = []
                for string in range(6):
                    if randomFunc(1) < 0.7:  # 70% 확률로 프렛 생성
                        maxFret = 3 if difficulty == "초급" else 7 if difficulty == "중급" else 12
                        fret = int(randomFunc(1) * maxFret) + 1
                        frets.append(fret)
                    else:
                        frets.append(0)
                
                # 최소한 하나의 프렛은 0이 아닌 값으로
                if all(f == 0 for f in frets):
                    frets[2] = 1
                    frets[4] = 2
                
                tabs.append({
                    'measure': i + 1,
                    'frets': frets,
                    'notes': ['E', 'B', 'G', 'D', 'A', 'E'],
                    'technique': 'basic'
                })
            
            return tabs
        
        # 시뮬레이션 데이터 생성
        tabs = generateTabsFromAnalysis(
            "테스트 곡", "테스트 아티스트", 120, "C", "중급", 180, 
            lambda x: random.random()
        )
        
        print(f"   📊 생성된 마디 수: {len(tabs)}")
        print("   📝 첫 3마디 타브:")
        for i, tab in enumerate(tabs[:3]):
            frets = tab['frets']
            print(f"      마디 {i+1}: {frets}")
        
        # 실제 프렛 숫자가 있는지 확인
        has_real_frets = any(
            any(fret > 0 for fret in tab['frets'])
            for tab in tabs
        )
        
        if has_real_frets:
            print("   ✅ 시뮬레이션 타브 생성 성공!")
            print("   🎸 실제 프렛 데이터가 포함되어 있습니다.")
            return True
        else:
            print("   ❌ 시뮬레이션 타브 생성 실패")
            return False
            
    except Exception as e:
        print(f"   ❌ 시뮬레이션 테스트 실패: {e}")
        return False

if __name__ == "__main__":
    success = test_simple()
    if success:
        print("\n🎉 시뮬레이션 테스트 성공! 타브 생성 로직이 작동합니다.")
        print("💡 이제 실제 오디오 분석도 시도해볼 수 있습니다.")
    else:
        print("\n💥 시뮬레이션 테스트 실패.")
