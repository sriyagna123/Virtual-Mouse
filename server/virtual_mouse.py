# -*- coding: utf-8 -*-
"""
virtual_mouse.py  —  VirtualMouse AI Standalone
═══════════════════════════════════════════════════════════════════════════════
Pure Python desktop app using MediaPipe 0.10+ Tasks API.
Controls the REAL OS cursor in ALL applications:
  Chrome, File Explorer, VS Code, Notepad, Desktop, Taskbar — everything.

REQUIREMENTS
    pip install mediapipe opencv-python pyautogui numpy

RUN
    python server/virtual_mouse.py
    python server/virtual_mouse.py --sensitivity 1.8 --alpha 0.2 --camera 0

GESTURES
    ☝  Index finger alone          →  Move cursor
    🤏  Thumb+Index pinch, release  →  Left click
    🤞  Thumb+Middle pinch, release →  Right click
    ✊  Hold left pinch 0.8s        →  Drag & drop (release to drop)
    ✌  Index+Middle up, move hand  →  Scroll (hand up = up, down = down)
    ✊  Full fist (no pinch)         →  Pause cursor

KEYBOARD  (OpenCV window must have focus)
    Q / ESC  →  Quit
    P        →  Pause / Resume
    +  / =   →  Sensitivity up
    -        →  Sensitivity down
    S        →  Toggle stats
    F        →  Toggle always-on-top

FAIL-SAFE
    Slam mouse to TOP-LEFT screen corner to abort pyautogui.
═══════════════════════════════════════════════════════════════════════════════
"""

import argparse
import ctypes
import math
import os
import sys
import time

import cv2
import numpy as np
import pyautogui

# ── MediaPipe 0.10 Tasks API ──────────────────────────────────────────────────
import mediapipe as mp
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    HandLandmarkerResult,
    RunningMode,
)

# ── PyAutoGUI config ──────────────────────────────────────────────────────────
pyautogui.FAILSAFE = True
pyautogui.PAUSE    = 0.0

# ── Screen ────────────────────────────────────────────────────────────────────
SCREEN_W, SCREEN_H = pyautogui.size()

# ── Model path (bundled next to this script) ──────────────────────────────────
_HERE       = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(_HERE, "hand_landmarker.task")

# ── Landmark indices ──────────────────────────────────────────────────────────
WRIST      = 0
THUMB_TIP  = 4
INDEX_PIP  = 6;  INDEX_TIP  = 8
MIDDLE_PIP = 10; MIDDLE_TIP = 12
RING_PIP   = 14; RING_TIP   = 16
PINKY_PIP  = 18; PINKY_TIP  = 20

# ── BGR colours ───────────────────────────────────────────────────────────────
C_CYAN   = (220, 210,   0)
C_GREEN  = (  0, 220,  80)
C_PINK   = (170,  40, 220)
C_ORANGE = (  0, 150, 240)
C_AMBER  = (  0, 185, 245)
C_RED    = ( 30,  30, 200)
C_WHITE  = (240, 240, 240)
C_DARK   = ( 12,  16,  28)
C_GREY   = ( 80,  80,  80)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def ldist(a, b) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)

def tip_up(lms, tip_i, pip_i) -> bool:
    """True when fingertip is above (smaller y) its PIP joint → extended."""
    return lms[tip_i].y < lms[pip_i].y

def to_px(lm, w, h):
    return int(lm.x * w), int(lm.y * h)


# ══════════════════════════════════════════════════════════════════════════════
# EMA smoother
# ══════════════════════════════════════════════════════════════════════════════

class Smoother:
    def __init__(self, alpha: float = 0.20):
        self.alpha = max(0.05, min(1.0, alpha))
        self.x = float(SCREEN_W) / 2
        self.y = float(SCREEN_H) / 2

    def update(self, tx, ty):
        self.x += self.alpha * (tx - self.x)
        self.y += self.alpha * (ty - self.y)
        return self.x, self.y


# ══════════════════════════════════════════════════════════════════════════════
# Cursor mapper
# ══════════════════════════════════════════════════════════════════════════════

class Mapper:
    """
    Maps a normalised landmark position to OS screen coords.
    After cv2.flip(frame,1) the landmark x values are already correct
    (0 = left of screen, 1 = right) — NO extra x inversion needed.
    """
    def __init__(self, sensitivity: float = 1.5,
                 margin: float = 0.10):
        self.sensitivity = sensitivity
        self.m = margin

    def map(self, lx: float, ly: float):
        # Clip outer margin
        x = (lx - self.m) / (1.0 - 2 * self.m)
        y = (ly - self.m) / (1.0 - 2 * self.m)
        x = max(0.0, min(1.0, x))
        y = max(0.0, min(1.0, y))
        # Expand from centre
        x = 0.5 + (x - 0.5) * self.sensitivity
        y = 0.5 + (y - 0.5) * self.sensitivity
        x = max(0.0, min(1.0, x))
        y = max(0.0, min(1.0, y))
        return x * SCREEN_W, y * SCREEN_H


# ══════════════════════════════════════════════════════════════════════════════
# Gesture state machine
# ══════════════════════════════════════════════════════════════════════════════

class GSM:
    """
    Priority order (no conflicts):
      1. FIST   → Pause  (all curled, no pinch)
      2. SCROLL → Scroll (index+middle up, ring/pinky down, no pinch)
      3. DRAG   → Drag   (left pinch held ≥ DRAG_S)
      4. LCLK   → Left click on pinch release
      5. RCLK   → Right click on pinch release
      6. MOVE   → Default
    """
    P_ENTER  = 0.050   # pinch-in threshold
    P_EXIT   = 0.078   # pinch-out threshold (hysteresis)
    DRAG_S   = 0.80    # seconds to enter drag mode
    CLICK_CD = 0.55    # click cooldown seconds
    SCRL_CD  = 0.07    # scroll step cooldown seconds

    MOVE  = "Move Cursor"
    LCLK  = "Left Click"
    RCLK  = "Right Click"
    DRAG  = "Drag & Drop"
    SCRL  = "Scroll"
    PAUSE = "Pause"
    NONE  = "No hand"

    def __init__(self, scroll_speed: int = 5):
        self.scroll_speed = scroll_speed
        self._pL   = False;  self._pL_t = 0.0
        self._pR   = False
        self._drag = False
        self._t_lc = 0.0;    self._t_rc = 0.0
        self._sy   = None;   self._st   = 0.0

    def process(self, lms) -> str:
        now = time.perf_counter()

        ie  = tip_up(lms, INDEX_TIP,  INDEX_PIP)
        me  = tip_up(lms, MIDDLE_TIP, MIDDLE_PIP)
        re  = tip_up(lms, RING_TIP,   RING_PIP)
        pe  = tip_up(lms, PINKY_TIP,  PINKY_PIP)
        dL  = ldist(lms[THUMB_TIP], lms[INDEX_TIP])
        dR  = ldist(lms[THUMB_TIP], lms[MIDDLE_TIP])

        # 1. FIST
        if not ie and not me and not re and not pe and dL > self.P_EXIT and dR > self.P_EXIT:
            self._reset_scroll(); self._exit_drag()
            self._pL = self._pR = False
            return self.PAUSE

        # 2. SCROLL — index+middle extended, ring+pinky curled, NO pinch
        # Uses absolute wrist Y to drive continuous scrolling:
        #   top 30 % of frame  → scroll up   (speed ∝ distance from centre)
        #   bottom 30 % of frame → scroll down
        #   middle 40 % dead-zone → no scroll
        if ie and me and not re and not pe and dL > self.P_EXIT and dR > self.P_EXIT:
            self._exit_drag()
            wy = lms[WRIST].y          # 0 = top of frame, 1 = bottom
            DEAD_TOP    = 0.30          # above this → scroll up
            DEAD_BOTTOM = 0.70          # below this → scroll down

            if now - self._st > self.SCRL_CD:
                if wy < DEAD_TOP:
                    # Hand raised — scroll up; speed ∝ how far above centre
                    speed = max(1, int((DEAD_TOP - wy) / DEAD_TOP * self.scroll_speed * 2 + 0.5))
                    pyautogui.scroll(speed, _pause=False)
                    self._st = now
                elif wy > DEAD_BOTTOM:
                    # Hand lowered — scroll down
                    speed = max(1, int((wy - DEAD_BOTTOM) / (1 - DEAD_BOTTOM) * self.scroll_speed * 2 + 0.5))
                    pyautogui.scroll(-speed, _pause=False)
                    self._st = now
            return self.SCRL
        self._reset_scroll()

        # 3 + 4. LEFT PINCH → drag or click
        if dL < self.P_ENTER:
            if not self._pL:
                self._pL   = True
                self._pL_t = now
            if not self._drag and (now - self._pL_t) >= self.DRAG_S:
                self._drag = True
                pyautogui.mouseDown(_pause=False)
            return self.DRAG if self._drag else self.LCLK
        elif self._pL:
            self._pL = False
            if self._drag:
                self._exit_drag()
            elif (now - self._t_lc) > self.CLICK_CD:
                self._t_lc = now
                pyautogui.click(_pause=False)

        # 5. RIGHT PINCH → right click
        if dR < self.P_ENTER:
            if not self._pR: self._pR = True
            return self.RCLK
        elif self._pR:
            self._pR = False
            if (now - self._t_rc) > self.CLICK_CD:
                self._t_rc = now
                pyautogui.rightClick(_pause=False)

        # 6. MOVE
        return self.MOVE

    def _reset_scroll(self): self._sy = None
    def _exit_drag(self):
        if self._drag:
            pyautogui.mouseUp(_pause=False)
            self._drag = False
    def cleanup(self): self._exit_drag()


# ══════════════════════════════════════════════════════════════════════════════
# HUD
# ══════════════════════════════════════════════════════════════════════════════

GCOL = {
    GSM.MOVE: C_CYAN,  GSM.LCLK: C_GREEN, GSM.RCLK: C_PINK,
    GSM.DRAG: C_ORANGE, GSM.SCRL: C_AMBER,
    GSM.PAUSE: C_GREY,  GSM.NONE: C_GREY,
}

SKEL = [
    (0,1),(1,2),(2,3),(3,4),
    (0,5),(5,6),(6,7),(7,8),
    (0,9),(9,10),(10,11),(11,12),
    (0,13),(13,14),(14,15),(15,16),
    (0,17),(17,18),(18,19),(19,20),
    (5,9),(9,13),(13,17),
]

def draw_skeleton(frame, lms, fh, fw):
    for a, b in SKEL:
        cv2.line(frame, to_px(lms[a], fw, fh), to_px(lms[b], fw, fh),
                 C_CYAN, 2, cv2.LINE_AA)
    for i, lm in enumerate(lms):
        pt = to_px(lm, fw, fh)
        if i in (4,8,12,16,20):
            cv2.circle(frame, pt, 7, C_CYAN, -1, cv2.LINE_AA)
            cv2.circle(frame, pt, 12, C_CYAN, 1, cv2.LINE_AA)
        elif i == 0:
            cv2.circle(frame, pt, 8, C_PINK, -1, cv2.LINE_AA)
        else:
            cv2.circle(frame, pt, 4, (190,160,255), -1, cv2.LINE_AA)

def draw_scroll_zones(frame):
    """Draw subtle scroll zone guides when in scroll mode."""
    h, w = frame.shape[:2]
    # Top scroll-up zone (top 30%)
    top_y = int(h * 0.30)
    cv2.rectangle(frame, (0, 0), (w, top_y), (0, 200, 100), 1)
    cv2.putText(frame, "^ SCROLL UP", (4, top_y - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 200, 100), 1, cv2.LINE_AA)
    # Bottom scroll-down zone (bottom 30%)
    bot_y = int(h * 0.70)
    cv2.rectangle(frame, (0, bot_y), (w, h), (0, 130, 220), 1)
    cv2.putText(frame, "v SCROLL DOWN", (4, bot_y + 13),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 130, 220), 1, cv2.LINE_AA)
    # Dead zone label
    mid_y = (top_y + bot_y) // 2
    cv2.putText(frame, "-- dead zone --", (w//2 - 48, mid_y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.32, (80, 80, 80), 1, cv2.LINE_AA)


def draw_hud(frame, gesture, conf, fps_v, sens, paused, stats):
    h, w = frame.shape[:2]
    # ── Top bar ──
    ov = frame.copy()
    cv2.rectangle(ov, (0, 0), (w, 28), C_DARK, -1)
    cv2.addWeighted(ov, 0.78, frame, 0.22, 0, frame)
    cv2.putText(frame, "VirtualMouse AI",
                (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.48, C_CYAN, 1, cv2.LINE_AA)
    # Live dot
    lc = C_GREY if paused else C_GREEN
    cv2.circle(frame, (w - 44, 14), 5, lc, -1, cv2.LINE_AA)
    cv2.putText(frame, "PAUSED" if paused else "LIVE",
                (w - 37, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.36, lc, 1, cv2.LINE_AA)
    # ── Bottom bar ──
    ov2 = frame.copy()
    cv2.rectangle(ov2, (0, h - 30), (w, h), C_DARK, -1)
    cv2.addWeighted(ov2, 0.78, frame, 0.22, 0, frame)
    gc = GCOL.get(gesture, C_WHITE)
    cv2.putText(frame, gesture,
                (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.46, gc, 1, cv2.LINE_AA)
    if stats:
        cc = C_GREEN if conf > 70 else (C_AMBER if conf > 40 else C_RED)
        cv2.putText(frame, f"{fps_v}fps",
                    (w - 58, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.36, C_GREEN, 1, cv2.LINE_AA)
        cv2.putText(frame, f"{conf}%",
                    (w - 96, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.36, cc, 1, cv2.LINE_AA)

def draw_flash(frame, gesture):
    col = GCOL.get(gesture)
    if col and gesture not in (GSM.MOVE, GSM.NONE, GSM.PAUSE):
        h, w = frame.shape[:2]
        cv2.rectangle(frame, (1,1),(w-2,h-2), col, 3)


# ══════════════════════════════════════════════════════════════════════════════
# Always-on-top (Windows)
# ══════════════════════════════════════════════════════════════════════════════

def set_topmost(win_name: str, on: bool):
    try:
        flags = 0x0001 | 0x0002           # SWP_NOSIZE | SWP_NOMOVE
        z     = -1 if on else -2          # HWND_TOPMOST / HWND_NOTOPMOST
        hwnd  = ctypes.windll.user32.FindWindowW(None, win_name)
        if hwnd:
            ctypes.windll.user32.SetWindowPos(hwnd, z, 0, 0, 0, 0, flags)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# Model download helper
# ══════════════════════════════════════════════════════════════════════════════

def ensure_model():
    if os.path.exists(MODEL_PATH):
        return
    print("[INFO] Downloading hand_landmarker.task (~7 MB) ...")
    import urllib.request
    url = ("https://storage.googleapis.com/mediapipe-models/"
           "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task")
    urllib.request.urlretrieve(url, MODEL_PATH)
    print(f"[INFO] Model saved: {MODEL_PATH}")


# ══════════════════════════════════════════════════════════════════════════════
# Main loop
# ══════════════════════════════════════════════════════════════════════════════

def run(sensitivity, alpha, scroll_speed, cam_idx):
    ensure_model()

    # ── Open camera ──────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(cam_idx)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open camera {cam_idx}. Try --camera 1 or 2.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS,          30)

    smoother = Smoother(alpha)
    mapper   = Mapper(sensitivity)
    gsm      = GSM(scroll_speed)

    # ── Shared state between callback thread and main thread ─────────────────
    latest = {
        "landmarks": None,   # list[NormalizedLandmark]  (21 items)
        "confidence": 0,
        "ts": 0,
    }

    # ── MediaPipe 0.10 live-stream setup ─────────────────────────────────────
    def on_result(result: HandLandmarkerResult, image, ts_ms: int):
        if result.hand_landmarks:
            latest["landmarks"]  = result.hand_landmarks[0]
            latest["confidence"] = int(
                result.handedness[0][0].score * 100) if result.handedness else 0
        else:
            latest["landmarks"]  = None
            latest["confidence"] = 0
        latest["ts"] = ts_ms

    options = HandLandmarkerOptions(
        base_options = BaseOptions(model_asset_path=MODEL_PATH),
        running_mode = RunningMode.LIVE_STREAM,
        num_hands    = 1,
        min_hand_detection_confidence = 0.65,
        min_hand_presence_confidence  = 0.60,
        min_tracking_confidence       = 0.50,
        result_callback = on_result,
    )
    landmarker = HandLandmarker.create_from_options(options)

    paused     = False
    show_stats = True
    topmost    = True
    fps_cnt    = 0
    fps_t      = time.perf_counter()
    fps_val    = 0
    conf       = 0
    gesture    = GSM.NONE
    frame_ms   = 0   # monotonic timestamp sent to MediaPipe

    # ── Small always-on-top mini window pinned to top-right corner ───────────
    WIN_W, WIN_H = 320, 240         # compact overlay size
    WIN = "VirtualMouse AI  |  Q=Quit  P=Pause"
    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WIN, WIN_W, WIN_H)

    # Position top-right, 10px from screen edge
    win_x = SCREEN_W - WIN_W - 10
    win_y = 10
    cv2.moveWindow(WIN, win_x, win_y)

    cv2.waitKey(80)                 # let window appear before SetWindowPos
    set_topmost(WIN, topmost)

    print()
    print("=" * 60)
    print("  VirtualMouse AI  —  Python Standalone (MediaPipe 0.10)")
    print("=" * 60)
    print(f"  Screen      : {SCREEN_W} × {SCREEN_H}")
    print(f"  Sensitivity : {sensitivity}  ( + / - to change live )")
    print(f"  Smoothing α : {alpha}")
    print(f"  Scroll speed: {scroll_speed}")
    print(f"  Camera      : {cam_idx}")
    print()
    print("  GESTURES:")
    print("    Index finger alone   → Move cursor")
    print("    Thumb+Index pinch    → Left click (fires on release)")
    print("    Thumb+Middle pinch   → Right click (fires on release)")
    print("    Hold pinch 0.8 s     → Drag & drop")
    print("    Index+Middle V up    → Scroll (move hand up / down)")
    print("    Full fist            → Pause cursor")
    print()
    print("  FAIL-SAFE: slam mouse to TOP-LEFT corner to abort.")
    print("=" * 60)
    print()

    while True:
        # ── Detect X-button close ─────────────────────────────────────────────
        # cv2.getWindowProperty returns -1 when the window has been closed
        try:
            if cv2.getWindowProperty(WIN, cv2.WND_PROP_VISIBLE) < 1:
                break
        except Exception:
            break

        ret, frame = cap.read()
        if not ret:
            time.sleep(0.02)
            continue

        # Mirror so the user sees themselves as in a mirror
        frame  = cv2.flip(frame, 1)
        fh, fw = frame.shape[:2]

        # Resize frame to match the small window for consistent drawing coords
        frame = cv2.resize(frame, (WIN_W, WIN_H))
        fh, fw = WIN_H, WIN_W

        # FPS
        fps_cnt += 1
        now_pc   = time.perf_counter()
        if now_pc - fps_t >= 1.0:
            fps_val = fps_cnt
            fps_cnt = 0
            fps_t   = now_pc

        # ── Send frame to MediaPipe (async, callback fires on another thread) ─
        if not paused:
            frame_ms += 33   # synthetic monotonic ms counter
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            try:
                landmarker.detect_async(mp_image, frame_ms)
            except Exception:
                pass

        # ── Process latest result (written by callback) ───────────────────────
        gesture = GSM.NONE
        lms     = latest["landmarks"]
        conf    = latest["confidence"]

        if lms and not paused:
            draw_skeleton(frame, lms, fh, fw)

            # Map index fingertip → screen coords
            # (frame already flipped → landmark.x is correct, no extra inversion)
            tx, ty = mapper.map(lms[INDEX_TIP].x, lms[INDEX_TIP].y)
            sx, sy = smoother.update(tx, ty)
            sx = max(1, min(SCREEN_W - 1, sx))
            sy = max(1, min(SCREEN_H - 1, sy))

            # Gesture + OS actions
            gesture = gsm.process(lms)

            if gesture in (GSM.MOVE, GSM.LCLK, GSM.RCLK, GSM.DRAG):
                pyautogui.moveTo(sx, sy, duration=0, _pause=False)

            # Draw cursor ring on index tip
            ix, iy = to_px(lms[INDEX_TIP], fw, fh)
            cv2.circle(frame, (ix, iy), 15, C_GREEN, 2, cv2.LINE_AA)

        elif paused:
            gesture = GSM.PAUSE

        # ── HUD ──────────────────────────────────────────────────────────────
        if gesture == GSM.SCRL:
            draw_scroll_zones(frame)
        draw_hud(frame, gesture, conf, fps_val,
                 mapper.sensitivity, paused, show_stats)
        draw_flash(frame, gesture)
        cv2.imshow(WIN, frame)

        # ── Keys ─────────────────────────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF
        if   key in (ord('q'), ord('Q'), 27): break
        elif key in (ord('p'), ord('P')):
            paused = not paused
            if paused:
                gsm.cleanup()       # release any held mouse button
                latest["landmarks"] = None
            print(f"  {'PAUSED' if paused else 'RESUMED'}")
        elif key in (ord('+'), ord('=')):
            mapper.sensitivity = min(4.0, round(mapper.sensitivity + 0.1, 1))
            print(f"  Sensitivity → {mapper.sensitivity}")
        elif key == ord('-'):
            mapper.sensitivity = max(0.3, round(mapper.sensitivity - 0.1, 1))
            print(f"  Sensitivity → {mapper.sensitivity}")
        elif key in (ord('s'), ord('S')):
            show_stats = not show_stats
        elif key in (ord('f'), ord('F')):
            topmost = not topmost
            set_topmost(WIN, topmost)
            print(f"  Always-on-top: {'ON' if topmost else 'OFF'}")

    # ── Cleanup ───────────────────────────────────────────────────────────────
    gsm.cleanup()
    landmarker.close()
    cap.release()
    cv2.destroyAllWindows()
    print("\n  VirtualMouse stopped.")


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    ap = argparse.ArgumentParser(
        description="VirtualMouse AI — hand gesture OS mouse (MediaPipe 0.10+)")
    ap.add_argument("--sensitivity",  "-s",  type=float, default=1.5)
    ap.add_argument("--alpha",        "-a",  type=float, default=0.20)
    ap.add_argument("--scroll-speed", "-sc", type=int,   default=5)
    ap.add_argument("--camera",       "-c",  type=int,   default=0)
    args = ap.parse_args()
    run(args.sensitivity, args.alpha, args.scroll_speed, args.camera)
