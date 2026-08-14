#!/usr/bin/env bash
set -euo pipefail

# Quick tunnel: URL changes every restart (like trycloudflare).
# For a stable friend URL, create a named tunnel (see README 친구 공유).

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[tunnel] cloudflared not found."
  echo "Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

echo "[tunnel] publishing http://localhost:3019"
echo "[tunnel] this URL is temporary unless you use a named tunnel"
exec cloudflared tunnel --url http://localhost:3019
