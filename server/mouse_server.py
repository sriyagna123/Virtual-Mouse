# -*- coding: utf-8 -*-
"""
mouse_server.py
────────────────────────────────────────────────────────────────────────────
WebSocket relay server — receives gesture events from the React browser app
and executes OS-level mouse actions via pyautogui.

Supports: move, left_click, right_click, double_click, drag_start, drag_end,
          scroll (with direction + amount), sensitivity config.

Run:  python server/mouse_server.py
Port: ws://localhost:8765
"""

import asyncio
import json
import logging
import time
import pyautogui
import websockets
from websockets.server import serve

# ── Safety ───────────────────────────────────────────────────────────────────
pyautogui.FAILSAFE = True
pyautogui.PAUSE    = 0.0

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mouse_server")

SCREEN_W, SCREEN_H = pyautogui.size()

# ─────────────────────────────────────────────────────────────────────────────
# Cursor smoothing
# ─────────────────────────────────────────────────────────────────────────────
_sx  = SCREEN_W / 2
_sy  = SCREEN_H / 2
ALPHA = 0.28   # EMA factor: lower = smoother (try 0.15–0.40)

def smooth(raw_x: float, raw_y: float):
    global _sx, _sy
    _sx = ALPHA * raw_x + (1 - ALPHA) * _sx
    _sy = ALPHA * raw_y + (1 - ALPHA) * _sy
    return _sx, _sy

# ─────────────────────────────────────────────────────────────────────────────
# Debounce / state
# ─────────────────────────────────────────────────────────────────────────────
_t_left_click  = 0.0
_t_right_click = 0.0
_t_dbl_click   = 0.0
_t_scroll      = 0.0
_drag_active   = False

CLICK_CD  = 0.55   # seconds between repeated clicks
SCROLL_CD = 0.08   # seconds between scroll steps

# ─────────────────────────────────────────────────────────────────────────────
# Message handler
# ─────────────────────────────────────────────────────────────────────────────
async def handle(msg: str):
    global _t_left_click, _t_right_click, _t_dbl_click, _t_scroll, _drag_active

    try:
        data = json.loads(msg)
    except json.JSONDecodeError:
        return

    t    = data.get("type", "")
    now  = time.time()

    # ── Move ─────────────────────────────────────────────────────────────────
    if t == "move":
        nx = max(0.0, min(1.0, float(data.get("x", 0.5))))
        ny = max(0.0, min(1.0, float(data.get("y", 0.5))))
        sx, sy = smooth(nx * SCREEN_W, ny * SCREEN_H)
        pyautogui.moveTo(sx, sy, duration=0, _pause=False)

    # ── Left click ────────────────────────────────────────────────────────────
    elif t == "left_click":
        if now - _t_left_click > CLICK_CD:
            _t_left_click = now
            pyautogui.click(_pause=False)
            log.info(f"Left click  ({int(_sx)}, {int(_sy)})")

    # ── Right click ───────────────────────────────────────────────────────────
    elif t == "right_click":
        if now - _t_right_click > CLICK_CD:
            _t_right_click = now
            pyautogui.rightClick(_pause=False)
            log.info(f"Right click ({int(_sx)}, {int(_sy)})")

    # ── Double click ──────────────────────────────────────────────────────────
    elif t == "double_click":
        if now - _t_dbl_click > CLICK_CD:
            _t_dbl_click = now
            pyautogui.doubleClick(_pause=False)
            log.info(f"Double click ({int(_sx)}, {int(_sy)})")

    # ── Drag start ────────────────────────────────────────────────────────────
    elif t == "drag_start":
        if not _drag_active:
            pyautogui.mouseDown(_pause=False)
            _drag_active = True
            log.info("Drag START")

    # ── Drag end ──────────────────────────────────────────────────────────────
    elif t == "drag_end":
        if _drag_active:
            pyautogui.mouseUp(_pause=False)
            _drag_active = False
            log.info("Drag END")

    # ── Scroll ────────────────────────────────────────────────────────────────
    elif t == "scroll":
        if now - _t_scroll > SCROLL_CD:
            _t_scroll   = now
            direction   = data.get("direction", "up")
            amount      = max(1, min(20, int(data.get("amount", 3))))
            clicks      = amount if direction == "up" else -amount
            pyautogui.scroll(clicks, _pause=False)
            log.info(f"Scroll {direction} x{amount}")

    # ── Config update at runtime ──────────────────────────────────────────────
    elif t == "config":
        global ALPHA
        if "alpha" in data:
            ALPHA = max(0.05, min(1.0, float(data["alpha"])))
            log.info(f"Alpha updated to {ALPHA}")

    else:
        log.debug(f"Unknown: {t}")


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket handler
# ─────────────────────────────────────────────────────────────────────────────
_clients: set = set()

async def ws_handler(websocket):
    _clients.add(websocket)
    addr = websocket.remote_address
    log.info(f"Client connected: {addr}  (total: {len(_clients)})")

    try:
        await websocket.send(json.dumps({
            "type":     "connected",
            "screen_w": SCREEN_W,
            "screen_h": SCREEN_H,
        }))
    except Exception:
        pass

    try:
        async for message in websocket:
            await handle(message)
    except websockets.exceptions.ConnectionClosedOK:
        pass
    except websockets.exceptions.ConnectionClosedError as e:
        log.warning(f"Connection error: {e}")
    finally:
        _clients.discard(websocket)
        # Release drag if client disconnects mid-drag
        global _drag_active
        if _drag_active:
            pyautogui.mouseUp(_pause=False)
            _drag_active = False
        log.info(f"Client disconnected: {addr}  (total: {len(_clients)})")


async def main():
    HOST, PORT = "localhost", 8765
    log.info("=" * 55)
    log.info("  VirtualMouse AI  --  WebSocket Mouse Server")
    log.info("=" * 55)
    log.info(f"  ws://{HOST}:{PORT}")
    log.info(f"  Screen: {SCREEN_W}x{SCREEN_H}   Alpha: {ALPHA}")
    log.info(f"  FAIL-SAFE: Move mouse to top-left to abort")
    log.info("=" * 55)

    async with serve(ws_handler, HOST, PORT, max_size=1_048_576):
        log.info("Server ready. Ctrl+C to stop.\n")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("\nServer stopped.")
