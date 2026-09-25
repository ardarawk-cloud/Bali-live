@echo off
title BALI LIVE MOTION PACK
cd /d "%~dp0"

rem Auto-update when this folder is inside a Git clone.
where git >nul 2>nul
if not errorlevel 1 (
  if exist "..\.git" (
    echo Checking Bali Live update...
    git -C "%~dp0.." pull --ff-only --quiet >nul 2>nul
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js belum terpasang.
  echo Install Node.js LTS dulu, lalu jalankan file ini lagi.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing Bali Live dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install gagal.
    pause
    exit /b 1
  )
)

if not exist .env (
  (
    echo OPENAI_API_KEY=
    echo OPENAI_MODEL=gpt-5.6-luna
    echo TIKFINITY_WS=ws://127.0.0.1:21213/
    echo PORT=8787
    echo USER_COOLDOWN_SECONDS=8
  ) > .env
)

echo.
echo Starting BALI LIVE MOTION PACK...
echo.
echo Motion overlay: http://localhost:8787/motion.html
echo AI overlay    : http://localhost:8787/overlay.html
echo.
echo TikFinity boleh tetap terbuka untuk follow/share/gift/join alerts.
echo.
node server.js
pause
