#!/usr/bin/env bash
set -euo pipefail

# Home-PC share mode: production Next + analysis backend.
# Browser uses same-origin /api/python (rewritten to :8002). Friends do not run npm.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${NEXT_PUBLIC_REAL_AUDIO_API_BASE:-}" || "${NEXT_PUBLIC_REAL_AUDIO_API_BASE}" == *localhost* ]]; then
  export NEXT_PUBLIC_REAL_AUDIO_API_BASE=/api/python
fi

echo "[start:public] NEXT_PUBLIC_REAL_AUDIO_API_BASE=${NEXT_PUBLIC_REAL_AUDIO_API_BASE}"
echo "[start:public] building frontend..."
npm run build

echo "[start:public] backend :8002 + frontend :3019 (keep this terminal open)"
exec npx concurrently -k -n backend,frontend "npm run dev:backend" "npm run start"
