@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   JanaMen Hackathon MVP
echo   http://localhost:3000
echo ========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 20 or newer.
  pause
  exit /b 1
)
start "" "http://localhost:3000"
node server.js
pause
