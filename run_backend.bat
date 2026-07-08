@echo off
rem Kartuli Caption Forge — start backend (Windows)
cd /d "%~dp0"
if not exist ".venv" (
  echo Creating Python venv...
  python -m venv .venv
  .venv\Scripts\pip install -r backend\requirements.txt
)
.venv\Scripts\python backend\app.py
