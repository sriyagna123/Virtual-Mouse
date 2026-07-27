@echo off
title VirtualMouse AI - Launcher
color 0A
echo.
echo  ============================================================
echo    VirtualMouse AI  -  Full System Launcher
echo  ============================================================
echo.
echo  [1/2] Starting Python WebSocket Mouse Server...
echo.

:: Start Python server in a separate window
start "VirtualMouse Python Server" cmd /k "cd /d "%~dp0server" && echo Starting mouse server... && python mouse_server.py"

:: Wait 2 seconds for Python server to boot
timeout /t 2 /nobreak >nul

echo  [2/2] Starting React Web App...
echo.
echo  The browser will open automatically at http://localhost:3000
echo.
echo  ============================================================
echo   HOW TO USE:
echo    1. Allow camera access when the browser asks
echo    2. Click "Start Camera" in the web app
echo    3. Show your hand to the camera
echo    4. Control your computer with gestures!
echo  ============================================================
echo.
echo  GESTURES:
echo    Index finger alone      = Move cursor
echo    Thumb + Index pinch     = Left click
echo    Thumb + Middle pinch    = Right click
echo    Hold pinch 0.8s         = Drag and drop
echo    Index + Middle V sign   = Scroll mode
echo    Full fist               = Pause
echo.
echo  FAIL-SAFE: Slam mouse to TOP-LEFT corner to stop pyautogui
echo.

:: Start React app (opens browser automatically)
cd /d "%~dp0"
npm start

pause
