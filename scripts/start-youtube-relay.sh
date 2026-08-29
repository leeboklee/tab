#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POT_PORT="${YTDLP_POT_PORT:-4416}"
TOR_SOCKS="${YTDLP_TOR_SOCKS:-socks5h://127.0.0.1:9050}"

start_tor_if_needed() {
  if [[ "${YTDLP_USE_TOR:-false}" != "true" && "${YTDLP_AUTO_TOR:-true}" != "true" ]]; then
    return 0
  fi
  if curl -s --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip 2>/dev/null | grep -q '"IsTor":true'; then
    echo "[youtube-relay] tor already running"
    return 0
  fi
  if ! command -v tor >/dev/null 2>&1; then
    echo "[youtube-relay] WARN tor not installed; YouTube may fail on datacenter IPs"
    return 0
  fi
  echo "[youtube-relay] starting tor"
  sudo service tor start >/dev/null 2>&1 || sudo systemctl start tor >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6; do
    if curl -s --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip 2>/dev/null | grep -q '"IsTor":true'; then
      echo "[youtube-relay] tor ready ($TOR_SOCKS)"
      return 0
    fi
    sleep 2
  done
  echo "[youtube-relay] WARN tor did not become ready"
}

start_pot_if_needed() {
  if [[ "${YTDLP_START_POT_PROVIDER:-true}" != "true" ]]; then
    return 0
  fi
  if curl -s -m 2 "http://127.0.0.1:${POT_PORT}/ping" | grep -q '"version"'; then
    echo "[youtube-relay] pot provider already running on :${POT_PORT}"
    return 0
  fi
  POT_DIR="$ROOT/tools/bgutil-ytdlp-pot-provider/server"
  if [[ ! -f "$POT_DIR/build/main.js" ]]; then
    echo "[youtube-relay] building bgutil pot provider"
    git clone --depth 1 --branch 1.3.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git "$ROOT/tools/bgutil-ytdlp-pot-provider" 2>/dev/null || true
    if [[ -f "$POT_DIR/package.json" ]]; then
      (cd "$POT_DIR" && npm install --silent && npx tsc)
    fi
  fi
  if [[ ! -f "$POT_DIR/build/main.js" ]]; then
    echo "[youtube-relay] WARN pot provider server missing; continuing without PO tokens"
    return 0
  fi
  echo "[youtube-relay] starting pot provider on :${POT_PORT}"
  nohup node "$POT_DIR/build/main.js" --port "$POT_PORT" >/tmp/pot-provider.log 2>&1 &
  for _ in 1 2 3 4 5; do
    if curl -s -m 2 "http://127.0.0.1:${POT_PORT}/ping" | grep -q '"version"'; then
      echo "[youtube-relay] pot provider ready"
      return 0
    fi
    sleep 1
  done
  echo "[youtube-relay] WARN pot provider did not respond"
}

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env.local"
  set +a
fi

start_tor_if_needed
start_pot_if_needed
