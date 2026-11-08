#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if command -v ollama >/dev/null && ! pgrep -x ollama >/dev/null; then
  ollama serve >/dev/null 2>&1 &
fi

(cd pipeline && uv run dnd-worker) &
worker=$!
trap 'kill $worker 2>/dev/null' EXIT

pnpm dev
