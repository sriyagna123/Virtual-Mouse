@echo off
title VirtualMouse AI — System Mouse Server
echo.
echo  ==============================================
echo   VirtualMouse AI  –  System Mouse Server
echo  ==============================================
echo.
echo  Starting Python WebSocket server on ws://localhost:8765
echo  This lets hand gestures control your REAL OS cursor.
echo.
echo  Press Ctrl+C to stop the server.
echo.
python "%~dp0mouse_server.py"
if errorlevel 1 (
    echo.
    echo  [ERROR] Server failed to start. Make sure Python and
    echo  pyautogui/websockets are installed:
    echo.
    echo    pip install pyautogui websockets
    echo.
    pause
)
