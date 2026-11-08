#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "dnd-pipeline only supports macOS for now."
  exit 1
fi
if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Note: this is an Intel Mac. The website works, but local models can't run here."
fi

ask() { read -r -p "$1 [Y/n] " reply; [[ -z "$reply" || "$reply" =~ ^[Yy] ]]; }

if ! command -v brew >/dev/null; then
  echo "Homebrew is required: https://brew.sh"
  exit 1
fi
for tool in node pnpm uv ffmpeg; do
  if ! command -v "$tool" >/dev/null; then
    if ask "$tool isn't installed. Install it with Homebrew?"; then
      brew install "$tool"
    else
      echo "$tool is required."; exit 1
    fi
  fi
done

echo "Installing website dependencies..."
pnpm install

echo "Installing pipeline dependencies..."
extras=()
[[ "$(uname -m)" == "arm64" ]] && extras=(--extra ml)
(cd pipeline && uv sync "${extras[@]}")

(cd pipeline && uv run dnd-setup)
