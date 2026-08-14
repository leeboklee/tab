#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Guitar2Tabs.
# Runs after the repository is checked out. Safe to run repeatedly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[install] installing frontend dependencies (npm ci)"
npm ci

echo "[install] preparing .env.local"
[ -f .env.local ] || cp .env.example .env.local

echo "[install] setting up python backend venv"
cd python-backend
PYBIN="$(command -v python3.11 || command -v python3)"
echo "[install] using python: $PYBIN ($($PYBIN --version 2>&1))"
if [ ! -x "venv/bin/python" ]; then
  "$PYBIN" -m venv venv
fi
./venv/bin/pip install --upgrade pip wheel >/dev/null
# real_analysis_main.py (port 8002) only needs the "real" dependency subset,
# not the heavy tensorflow/torch stack in requirements.txt.
./venv/bin/pip install -r requirements-real.txt

echo "[install] done"
