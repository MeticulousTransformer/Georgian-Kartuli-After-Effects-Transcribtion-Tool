@echo off
rem CapForge — start backend (Windows)
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  goto failure
)
.venv\Scripts\python -c "import fastapi, uvicorn, pydantic, requests, imageio_ffmpeg" >nul 2>nul
if errorlevel 1 (
  goto failure
)
.venv\Scripts\python backend\start_service.py
if errorlevel 2 goto occupied
if errorlevel 1 goto failure
exit /b 0
:failure
echo.
echo CapForge could not start. Run Install Windows.cmd again to repair setup.
pause
exit /b 1
:occupied
echo.
echo CapForge could not connect. See the service message above.
pause
exit /b 2
