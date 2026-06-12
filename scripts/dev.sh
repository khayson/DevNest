#!/usr/bin/env bash
# Start DevNest development environment (macOS / Linux)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "==> Building Go daemon..."
(cd "$BACKEND" && go build -o devnest .)

echo "==> Starting daemon on ws://127.0.0.1:9090/ws ..."
(cd "$BACKEND" && ./devnest daemon) &
DAEMON_PID=$!
trap 'kill "$DAEMON_PID" 2>/dev/null || true' EXIT

sleep 2

echo "==> Starting frontend on http://localhost:5173 ..."
cd "$FRONTEND"
if [ ! -d node_modules ]; then
  echo "    Installing npm dependencies..."
  npm install
fi
npm run dev
