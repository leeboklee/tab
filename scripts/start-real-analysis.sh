#!/bin/bash
set -e

PORT=8002
HEALTH_URL="http://localhost:$PORT/health"

test_healthy_server() {
  curl -s -m 5 "$HEALTH_URL" | grep -q '"status"' || return 1
}

if test_healthy_server; then
  echo "[backend] healthy server already running on :$PORT, reusing existing process"
  exit 0
fi

# Check if port is occupied
PID=$(lsof -t -i :$PORT || true)
if [ ! -z "$PID" ]; then
  echo "[backend] port $PORT is occupied but health check failed. pid=$PID"
  echo "[backend] stop the stale process or restart it before running dev again"
  exit 1
fi

echo "[backend] starting real_analysis_main.py on :$PORT"
cd "$(dirname "$0")/../python-backend"

if [ -d "venv" ]; then
  echo "[backend] activating virtual environment"
  source venv/bin/activate
fi

# Run the real analysis backend
python3 real_analysis_main.py
