#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/python-backend"
VENV_PY="$BACKEND/venv/bin/python"
BASE_URL="${REAL_AUDIO_API_BASE:-http://localhost:8002}"
BASE_URL="${BASE_URL%/}"

if [[ ! -x "$VENV_PY" ]]; then
  echo "[check:backend] venv missing — run: cd python-backend && python -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
fi

echo "[check:backend] py_compile"
"$VENV_PY" -m py_compile "$BACKEND/real_analysis_main.py"

echo "[check:backend] import"
"$VENV_PY" -c "import sys; sys.path.insert(0,'$BACKEND'); import real_analysis_main; print('import OK', real_analysis_main.app.title)"

echo "[check:backend] health $BASE_URL/health"
HEALTH=$(curl -sS -m 5 "$BASE_URL/health" || true)
if [[ -z "$HEALTH" ]]; then
  echo "[check:backend] WARN backend not running — start: npm run dev:backend"
  exit 1
fi

echo "$HEALTH" | "$VENV_PY" -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('status') == 'healthy', d
svc = d.get('services', {})
assert 'analysis_cache' in svc, svc.keys()
assert 'analysis_inflight_locks' in svc, svc.keys()
print('[check:backend] health OK cache+locks exposed')
"

echo "[check:backend] analysis-metrics"
METRICS=$(curl -sS -m 5 "$BASE_URL/analysis-metrics")
echo "$METRICS" | "$VENV_PY" -c "
import json, sys
d = json.load(sys.stdin)
for key in ('cache', 'inflight_locks', 'recent_requests'):
    assert key in d, d.keys()
print('[check:backend] metrics OK')
"

echo "[check:backend] pass"
