#!/usr/bin/env bash
# START_VIRTUAL_MOUSE.sh — macOS / Linux launcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo " ========================================================="
echo "  VirtualMouse AI  --  Python Standalone Desktop App"
echo " ========================================================="
echo ""

# Check dependencies
python3 -c "import mediapipe, cv2, pyautogui, numpy" 2>/dev/null || {
    echo " [!] Missing packages. Installing now..."
    pip3 install mediapipe opencv-python pyautogui numpy
    echo ""
}

echo " Controls:"
echo "   Q / ESC  = Quit"
echo "   P        = Pause / Resume"
echo "   +/-      = Sensitivity"
echo "   S        = Toggle stats"
echo ""
echo " FAIL-SAFE: Move mouse to TOP-LEFT corner to abort."
echo ""

python3 "$SCRIPT_DIR/virtual_mouse.py" "$@"
