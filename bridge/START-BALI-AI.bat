@echo off
title BALI LIVE AI
cd /d "%~dp0"

rem Auto-update when this folder is inside a Git clone.
where git >nul 2>nul
if not errorlevel 1 (
  if exist "..\.git" (
    echo Checking BALI LIVE AI update...
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
  echo Installing BALI LIVE AI dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install gagal.
    pause
    exit /b 1
  )
)

if not exist .env (
  call node setup.js
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo.
echo Starting BALI LIVE AI...
echo TikFinity Desktop harus tetap terbuka.
echo.
node server.js
pause
