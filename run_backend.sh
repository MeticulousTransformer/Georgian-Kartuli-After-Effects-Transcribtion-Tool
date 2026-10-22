#!/bin/bash
# CapForge — start backend (macOS / Linux)
set -e
cd "$(dirname "$0")"
if [ ! -x ".venv/bin/python" ]; then
  echo "CapForge setup needs repair. Open Install macOS.command again."
  exit 1
fi
if ! ./.venv/bin/python -c 'import fastapi, uvicorn, pydantic, requests, imageio_ffmpeg' >/dev/null 2>&1; then
  echo "CapForge setup needs repair. Open Install macOS.command again."
  exit 1
fi
exec ./.venv/bin/python backend/start_service.py
