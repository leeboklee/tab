import requests
import json

def test_youtube_analysis():
    url = "https://youtu.be/y5MAgMVwfFs?si=3va491v6rEW1AD3s"
    
    try:
        print(f"Testing YouTube analysis for: {url}")
        
        response = requests.post('http://localhost:8000/analyze', 
                               json={'url': url},
                               timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Analysis successful!")
            print(f"Title: {result['data']['title']}")
            print(f"Artist: {result['data']['artist']}")
            print(f"Tempo: {result['data']['tempo']}")
            print(f"Key: {result['data']['key']}")
            print(f"Difficulty: {result['data']['difficulty']}")
            print(f"Tabs count: {len(result['data']['tabs'])}")
            print(f"Chord progressions: {len(result['data']['chord_progressions'])}")
            print(f"Analysis method: {result['data']['metadata']['analysis_method']}")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Backend server not running")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_youtube_analysis()