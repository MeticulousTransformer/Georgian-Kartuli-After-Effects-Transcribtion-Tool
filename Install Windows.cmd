@echo off
cd /d "%~dp0"
start "CapForge Setup" /b powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "%~dp0installer\bootstrap_windows.ps1"
