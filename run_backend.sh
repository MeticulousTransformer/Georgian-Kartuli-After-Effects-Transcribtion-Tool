#!/bin/bash
# Kartuli Caption Forge — start backend (macOS / Linux)
cd "$(dirname "$0")"
if [ ! -d ".venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv .venv
  ./.venv/bin/pip install -r backend/requirements.txt
fi
exec ./.venv/bin/python backend/app.py
