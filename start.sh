#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p logs

if command -v ollama >/dev/null && ! pgrep -x ollama >/dev/null; then
  ollama serve >logs/ollama.log 2>&1 &
elif pgrep -x ollama >/dev/null; then
  echo "Ollama was already running; its log is in ~/.ollama/logs/server.log" > logs/ollama.log
fi

(cd pipeline && uv run dnd-worker) &
worker=$!
trap 'kill $worker 2>/dev/null' EXIT

pnpm dev 2>&1 | tee logs/site.log
