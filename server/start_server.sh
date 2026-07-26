#!/usr/bin/env bash
# start_server.sh — Start the VirtualMouse AI system mouse server (macOS/Linux)
echo ""
echo " ============================================="
echo "  VirtualMouse AI  —  System Mouse Server"
echo " ============================================="
echo ""
echo " Starting Python WebSocket server on ws://localhost:8765"
echo " This lets hand gestures control your REAL OS cursor."
echo ""
echo " Press Ctrl+C to stop."
echo ""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/mouse_server.py"
