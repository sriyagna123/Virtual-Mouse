@echo off
title VirtualMouse AI
color 0A
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       VirtualMouse AI  —  Standalone         ║
echo  ║  Controls your REAL cursor system-wide       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Checking Python packages...
python -c "import cv2, mediapipe, pyautogui, numpy" 2>nul
if errorlevel 1 (
    echo  [!] Installing required packages...
    pip install mediapipe opencv-python pyautogui numpy
    echo.
)
echo  Launching Virtual Mouse...
echo.
echo  ┌─ GESTURES ────────────────────────────────┐
echo  │  Index finger alone   =  Move cursor      │
echo  │  Thumb + Index pinch  =  Left click        │
echo  │  Thumb + Middle pinch =  Right click       │
echo  │  Hold pinch 0.8s      =  Drag and drop     │
echo  │  Index + Middle up    =  Scroll            │
echo  │  Full fist            =  Pause cursor      │
echo  └───────────────────────────────────────────┘
echo.
echo  ┌─ KEYS (click the camera window first) ────┐
echo  │  Q / ESC  =  Quit                         │
echo  │  P        =  Pause / Resume               │
echo  │  + / -    =  Sensitivity up / down        │
echo  │  S        =  Toggle stats                 │
echo  │  F        =  Toggle always-on-top         │
echo  └───────────────────────────────────────────┘
echo.
echo  FAIL-SAFE: Slam mouse to TOP-LEFT corner to abort.
echo.
python "%~dp0virtual_mouse.py" %*
if errorlevel 1 (
    echo.
    echo  [ERROR] Something went wrong. See message above.
    echo  Common fix:  pip install mediapipe opencv-python pyautogui numpy
    echo.
    pause
)
