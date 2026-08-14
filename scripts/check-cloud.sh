#!/bin/bash
set -euo pipefail

# Optional: ping CLOUD_ANALYSIS_API_BASE. Skips (exit 0) when unset.
# Does not read .env files — export the var in the shell if you want a live check.

BASE="${CLOUD_ANALYSIS_API_BASE:-}"
BASE="${BASE%/}"

if [[ -z "$BASE" ]]; then
  echo "[check:cloud] SKIP — CLOUD_ANALYSIS_API_BASE unset (quality=cloud will return cloud_not_configured)"
  exit 0
fi

echo "[check:cloud] GET $BASE/health"
CODE=$(curl -sS -o /tmp/cloud-health.json -w '%{http_code}' -m 10 "$BASE/health" || true)
if [[ "$CODE" != "200" ]]; then
  echo "[check:cloud] FAIL health HTTP $CODE"
  exit 1
fi
echo "[check:cloud] pass ($CODE)"
