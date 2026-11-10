@echo off
setlocal enabledelayedexpansion
echo Stopping MusicCube...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5188 " ^| findstr "LISTENING"') do (
    echo Stopping process on port 5188 ^(PID %%P^)...
    taskkill /F /PID %%P >nul 2>&1
)

rem Only this app's window, never other Electron apps (they all share the image name electron.exe).
taskkill /IM electron.exe /FI "WINDOWTITLE eq MusicCube*" >nul 2>&1

echo Done.
