import requests
import json

url = "http://localhost:8000/analyze"
data = {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
