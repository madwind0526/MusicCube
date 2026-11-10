@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem MusicCube: Electron shell. Default = build + run dist. "start.bat dev" = Vite dev server (port 5188) + Electron --dev.
set "WEB_PORT=5188"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"

echo Checking for an existing MusicCube on port %WEB_PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%WEB_PORT% " ^| findstr "LISTENING"') do (
    echo Found existing process on port %WEB_PORT% ^(PID %%P^) - stopping it...
    taskkill /F /PID %%P >nul 2>&1
)
taskkill /F /IM electron.exe /FI "WINDOWTITLE eq MusicCube*" >nul 2>&1

for /l %%I in (1,1,20) do (
    netstat -ano | findstr ":%WEB_PORT% " | findstr "LISTENING" >nul 2>&1 || goto :portfree
    ping -n 2 127.0.0.1 >nul
)
:portfree

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install || (echo Install failed. & pause & exit /b 1)
)

if /i "%MODE%"=="dev" (
    start "MusicCube Vite" /min cmd /c "npm run dev"
    ping -n 4 127.0.0.1 >nul
    start "MusicCube App" /min cmd /c "npm run start:dev"
) else (
    call npm run build || (echo Build failed. & pause & exit /b 1)
    start "MusicCube App" /min cmd /c "npm start"
)
echo Done.
