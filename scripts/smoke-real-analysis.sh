#!/bin/bash
set -e

BASE_URL="${REAL_AUDIO_API_BASE:-http://localhost:8002}"
BASE_URL="${BASE_URL%/}"

SAMPLE_URLS=(
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  "https://www.youtube.com/watch?v=fAVQnVkB2ho"
)

echo "[smoke] checking health: $BASE_URL/health"
HEALTH_STATUS=$(curl -s -m 10 "$BASE_URL/health" || echo "")

if [ -z "$HEALTH_STATUS" ]; then
  echo "Error: health check failed, backend not running"
  exit 1
fi

echo "[smoke] health response: $HEALTH_STATUS"

for URL in "${SAMPLE_URLS[@]}"; do
  echo "[smoke] analyzing $URL"
  RESPONSE=$(curl -s -X POST "$BASE_URL/analyze" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}")
  
  echo "[smoke] response: $RESPONSE"
done

echo "[smoke] smoke test completed!"
