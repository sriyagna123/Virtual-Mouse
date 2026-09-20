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
    ✌  Middle+Ring up, move hand   →  Scroll (hand up = up, down = down)
    ✊  Full fist (no pinch)         →  Pause cursor

KEYBOARD  (type in the terminal while running)
    Q / ESC  →  Quit
    P        →  Pause / Resume
    +  / =   →  Sensitivity up
    -        →  Sensitivity down
    S        →  Toggle stats
    F        →  Toggle always-on-top
    C        →  Toggle click-through (so you can click other apps freely)

FAIL-SAFE
    Slam mouse to TOP-LEFT screen corner to abort pyautogui.
═══════════════════════════════════════════════════════════════════════════════
"""

import argparse
import ctypes
import math
import msvcrt
import os
import sys
import time
import threading
from collections import Counter, deque

import cv2
import numpy as np
import pyautogui

from config import (
    CAMERA_INDEX,
    DEBUG_MODE,
    DEAD_ZONE,
    DRAG_HOLD_SECONDS,
    DRAG_THRESHOLD,
    GESTURE_STABLE_FRAMES,
    MIN_DETECTION_CONFIDENCE,
    MIN_TRACKING_CONFIDENCE,
    MOVE,
    MOVEMENT_SENSITIVITY,
    PAUSE_ON_OPEN_PALM,
    PINCH_RELEASE_THRESHOLD,
    PINCH_START_THRESHOLD,
    SCROLL_COOLDOWN,
    SCROLL_THRESHOLD,
    SENSITIVITY,
    SMOOTHING_FACTOR,
)

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


def send_windows_wheel(delta_steps: int, debug: bool = False):
    """Send a genuine Windows OS wheel event to the foreground app."""
    if delta_steps == 0:
        if debug:
            print("[SCROLL 9] Wheel event function called: FALSE")
            print("[SCROLL 10] Windows wheel event sent: FALSE")
        return False

    wheel_delta = int(delta_steps * 120)
    if debug:
        print(f"[SCROLL 8] Calculated wheel amount: {delta_steps} steps -> {wheel_delta} wheel delta")
        print("[SCROLL 9] Wheel event function called: TRUE")

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [
            ("dx", ctypes.c_long),
            ("dy", ctypes.c_long),
            ("mouseData", ctypes.c_ulong),
            ("dwFlags", ctypes.c_ulong),
            ("time", ctypes.c_ulong),
            ("dwExtraInfo", ctypes.c_void_p),
        ]

    class INPUT(ctypes.Structure):
        _fields_ = [
            ("type", ctypes.c_ulong),
            ("mi", MOUSEINPUT),
        ]

    MOUSEEVENTF_WHEEL = 0x0800
    input_struct = INPUT()
    input_struct.type = 0
    input_struct.mi.dx = 0
    input_struct.mi.dy = 0
    input_struct.mi.mouseData = ctypes.c_ulong(wheel_delta).value
    input_struct.mi.dwFlags = MOUSEEVENTF_WHEEL
    input_struct.mi.time = 0
    input_struct.mi.dwExtraInfo = None

    sent = ctypes.windll.user32.SendInput(1, ctypes.byref(input_struct), ctypes.sizeof(INPUT))
    ok = sent == 1
    if debug:
        print(f"[SCROLL 10] Windows wheel event sent: {ok}")
    return ok


# ══════════════════════════════════════════════════════════════════════════════
# EMA smoother
# ══════════════════════════════════════════════════════════════════════════════

class Smoother:
    def __init__(self, alpha: float = None, deadzone: float = None):
        self.alpha = max(0.05, min(1.0, float(alpha if alpha is not None else SMOOTHING_FACTOR)))
        self.deadzone = float(deadzone if deadzone is not None else DEAD_ZONE)
        self.x = float(SCREEN_W) / 2
        self.y = float(SCREEN_H) / 2

    def update(self, tx, ty):
        dx = tx - self.x
        dy = ty - self.y
        if abs(dx) < self.deadzone and abs(dy) < self.deadzone:
            return self.x, self.y
        self.x += self.alpha * dx
        self.y += self.alpha * dy
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
    def __init__(self, sensitivity: float = None,
                 margin: float = 0.10):
        self.sensitivity = float(sensitivity if sensitivity is not None else SENSITIVITY)
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
    Stabilized gesture recognizer using normalized distances, temporal filtering,
    hysteresis, and a small state machine so clicks and drags are not repeated.
    """
    P_ENTER = float(PINCH_START_THRESHOLD)
    P_EXIT = float(PINCH_RELEASE_THRESHOLD)
    DRAG_S = float(DRAG_HOLD_SECONDS)
    CLICK_CD = float(GESTURE_STABLE_FRAMES * 0.1 + 0.45)
    SCRL_CD = float(SCROLL_COOLDOWN)

    MOVE = "Move Cursor"
    LCLK = "Left Click"
    RCLK = "Right Click"
    DRAG = "Drag & Drop"
    SCRL = "Scroll"
    PAUSE = "Pause"
    NONE = "No hand"

    def __init__(self, scroll_speed: int = 5):
        self.scroll_speed = scroll_speed
        self._pL = False
        self._pL_t = 0.0
        self._pR = False
        self._pR_t = 0.0
        self._drag = False
        self._t_lc = 0.0
        self._t_rc = 0.0
        self._st = 0.0
        self._scroll_ref_y = None
        self._scroll_last_time = 0.0
        self._scroll_state = "IDLE"
        self._scroll_delta = 0.0
        self._scroll_velocity = 0.0
        self._scroll_direction = "NONE"
        self._current = self.NONE
        self._history = deque(maxlen=GESTURE_STABLE_FRAMES)
        self._last_move = 0.0

    def _metrics(self, lms):
        def dist3(a, b):
            return math.hypot(a.x - b.x, a.y - b.y)

        palm_size = max(dist3(lms[0], lms[9]), dist3(lms[5], lms[17]), 0.001)
        thumb_index = dist3(lms[THUMB_TIP], lms[INDEX_TIP]) / palm_size
        thumb_middle = dist3(lms[THUMB_TIP], lms[MIDDLE_TIP]) / palm_size
        index_ext = tip_up(lms, INDEX_TIP, INDEX_PIP)
        middle_ext = tip_up(lms, MIDDLE_TIP, MIDDLE_PIP)
        ring_ext = tip_up(lms, RING_TIP, RING_PIP)
        pinky_ext = tip_up(lms, PINKY_TIP, PINKY_PIP)
        wrist_y = lms[WRIST].y
        open_palm = index_ext and middle_ext and ring_ext and pinky_ext
        return {
            "palm_size": palm_size,
            "thumb_index": thumb_index,
            "thumb_middle": thumb_middle,
            "index_ext": index_ext,
            "middle_ext": middle_ext,
            "ring_ext": ring_ext,
            "pinky_ext": pinky_ext,
            "open_palm": open_palm,
            "wrist_y": wrist_y,
        }

    def _stable_label(self):
        if not self._history:
            return self.NONE
        counts = Counter(self._history)
        label, _ = counts.most_common(1)[0]
        return label

    def get_scroll_debug(self):
        return {
            "state": self._scroll_state,
            "delta": round(self._scroll_delta, 4),
            "velocity": round(self._scroll_velocity, 3),
            "direction": self._scroll_direction,
        }

    def process(self, lms) -> str:
        now = time.perf_counter()
        metrics = self._metrics(lms)
        dL = metrics["thumb_index"]
        dR = metrics["thumb_middle"]
        ie = metrics["index_ext"]
        me = metrics["middle_ext"]
        re = metrics["ring_ext"]
        pe = metrics["pinky_ext"]

        scroll_detected = bool(me and re and not ie and not pe and dL > self.P_EXIT and dR > self.P_EXIT)
        if DEBUG_MODE:
            print(f"[SCROLL 1] Gesture detected: {scroll_detected}")
            print(f"[SCROLL 2] Gesture name: {self.SCRL if scroll_detected else 'NONE'}")

        if PAUSE_ON_OPEN_PALM and metrics["open_palm"]:
            self._reset_scroll()
            self._exit_drag()
            self._pL = self._pR = False
            self._history.clear(); self._history.append(self.PAUSE)
            self._current = self.PAUSE
            return self.PAUSE

        if not ie and not me and not re and not pe and dL > self.P_EXIT and dR > self.P_EXIT:
            self._reset_scroll(); self._exit_drag()
            self._pL = self._pR = False
            self._history.append(self.PAUSE)
            self._current = self._stable_label()
            return self.PAUSE

        if scroll_detected:
            self._exit_drag()
            wy = metrics["wrist_y"]
            if self._scroll_ref_y is None:
                self._scroll_ref_y = wy
                self._scroll_state = "CANDIDATE"
                self._scroll_delta = 0.0
                self._scroll_velocity = 0.0
                self._scroll_direction = "NONE"
                if DEBUG_MODE:
                    print(f"[SCROLL 3] Scroll state: {self._scroll_state}")
                    print(f"[SCROLL 4] Current Y: {wy}")
                    print("[SCROLL 5] Previous Y: 0.0")
                    print("[SCROLL 6] Delta Y: 0.0")
            else:
                prev_y = self._scroll_ref_y
                dy = prev_y - wy
                dt = max(0.016, now - self._scroll_last_time if self._scroll_last_time else 0.016)
                self._scroll_delta = dy
                self._scroll_velocity = abs(dy) / dt
                if dy > 0:
                    self._scroll_direction = "UP"
                elif dy < 0:
                    self._scroll_direction = "DOWN"
                else:
                    self._scroll_direction = "NONE"

                if DEBUG_MODE:
                    print(f"[SCROLL 3] Scroll state: {'ACTIVE' if abs(dy) > SCROLL_THRESHOLD and now - self._st > self.SCRL_CD else 'INACTIVE'}")
                    print(f"[SCROLL 4] Current Y: {wy}")
                    print(f"[SCROLL 5] Previous Y: {prev_y}")
                    print(f"[SCROLL 6] Delta Y: {dy}")
                    print(f"[SCROLL 7] Direction: {self._scroll_direction}")

                if abs(dy) > SCROLL_THRESHOLD and now - self._st > self.SCRL_CD:
                    self._scroll_state = "ACTIVE"
                    amount = max(1, min(12, int(abs(dy) * 90 + self._scroll_velocity * 2)))
                    direction = 1 if dy > 0 else -1
                    if DEBUG_MODE:
                        print(f"[SCROLL 8] Calculated wheel amount: {direction * amount}")
                    wheel_ok = send_windows_wheel(direction * amount, debug=DEBUG_MODE)
                    if DEBUG_MODE and not wheel_ok:
                        print("[SCROLL 10] Windows wheel event sent: FALSE")
                    self._st = now
                    self._scroll_ref_y = wy
                    self._scroll_last_time = now
                else:
                    self._scroll_state = "INACTIVE"
                    if DEBUG_MODE:
                        print(f"[SCROLL 3] Scroll state: INACTIVE")
            self._history.append(self.SCRL)
            self._current = self._stable_label()
            return self.SCRL
        self._scroll_state = "IDLE"
        self._scroll_delta = 0.0
        self._scroll_velocity = 0.0
        self._scroll_direction = "NONE"
        self._reset_scroll()

        if dL < self.P_ENTER:
            if not self._pL:
                self._pL = True
                self._pL_t = now
            if not self._drag and (now - self._pL_t) >= self.DRAG_S:
                self._drag = True
                pyautogui.mouseDown(_pause=False)
                self._history.append(self.DRAG)
                self._current = self._stable_label()
                return self.DRAG
            if not self._drag:
                self._history.append(self.LCLK)
                self._current = self._stable_label()
                return self.LCLK
        elif self._pL:
            self._pL = False
            if self._drag:
                pyautogui.mouseUp(_pause=False)
                self._drag = False
                self._current = self.MOVE
            elif (now - self._t_lc) > self.CLICK_CD:
                pyautogui.click(_pause=False)
                self._t_lc = now
                self._current = self.LCLK
            self._history.append(self._current)
            return self._current

        if dR < self.P_ENTER:
            if not self._pR:
                self._pR = True
                self._pR_t = now
            self._history.append(self.RCLK)
            self._current = self._stable_label()
            return self.RCLK
        elif self._pR:
            self._pR = False
            if (now - self._t_rc) > self.CLICK_CD:
                pyautogui.rightClick(_pause=False)
                self._t_rc = now
            self._current = self.MOVE
            self._history.append(self.MOVE)
            return self.MOVE

        self._history.append(self.MOVE)
        self._current = self._stable_label()
        return self.MOVE

    def _reset_scroll(self):
        self._scroll_ref_y = None

    def _exit_drag(self):
        if self._drag:
            pyautogui.mouseUp(_pause=False)
            self._drag = False

    def cleanup(self):
        self._exit_drag()


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


def draw_hud(frame, gesture, conf, fps_v, sens, paused, stats, debug=False, pinch_distance=None, mouse_xy=None, scroll_debug=None):
    h, w = frame.shape[:2]
    ov = frame.copy()
    cv2.rectangle(ov, (0, 0), (w, 28), C_DARK, -1)
    cv2.addWeighted(ov, 0.78, frame, 0.22, 0, frame)
    cv2.putText(frame, "VirtualMouse AI",
                (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.48, C_CYAN, 1, cv2.LINE_AA)
    lc = C_GREY if paused else C_GREEN
    cv2.circle(frame, (w - 44, 14), 5, lc, -1, cv2.LINE_AA)
    cv2.putText(frame, "PAUSED" if paused else "LIVE",
                (w - 37, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.36, lc, 1, cv2.LINE_AA)
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

    if debug:
        y = 38
        mouse_text = "n/a"
        if mouse_xy and mouse_xy[0] is not None and mouse_xy[1] is not None:
            mouse_text = f"{int(mouse_xy[0])}, {int(mouse_xy[1])}"
        lines = [
            f"Gesture: {gesture}",
            f"Confidence: {conf}%",
            f"Pinch Distance: {pinch_distance if pinch_distance is not None else 'n/a'}",
            f"State: {'PAUSED' if paused else 'ACTIVE'}",
            f"Mouse: {mouse_text}",
            f"FPS: {fps_v}",
            f"Sensitivity: {sens:.2f}",
        ]
        if scroll_debug:
            lines.extend([
                f"Scroll Delta: {scroll_debug.get('delta', 0.0)}",
                f"Velocity: {scroll_debug.get('velocity', 0.0)}",
                f"Direction: {scroll_debug.get('direction', 'NONE')}",
                f"Scroll State: {scroll_debug.get('state', 'IDLE')}",
            ])
        for line in lines:
            cv2.putText(frame, line, (8, y), cv2.FONT_HERSHEY_SIMPLEX, 0.34, C_WHITE, 1, cv2.LINE_AA)
            y += 16

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


def set_click_through(win_name: str, on: bool):
    """
    Make the OpenCV window transparent to mouse clicks (WS_EX_TRANSPARENT).
    When on=True  → all mouse events pass through the window to whatever is below.
    When on=False → normal window (can be clicked / focused).
    This lets users interact with Chrome, File Explorer etc. even while the
    overlay is floating above them.
    """
    try:
        GWL_EXSTYLE      = -20
        WS_EX_LAYERED    = 0x00080000
        WS_EX_TRANSPARENT = 0x00000020
        hwnd = ctypes.windll.user32.FindWindowW(None, win_name)
        if not hwnd:
            return
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        if on:
            style |=  (WS_EX_LAYERED | WS_EX_TRANSPARENT)
        else:
            style &= ~WS_EX_TRANSPARENT
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
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

def run(sensitivity, alpha, scroll_speed, cam_idx, debug_mode=False):
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

    smoother = Smoother(alpha=alpha, deadzone=DEAD_ZONE)
    mapper   = Mapper(sensitivity=SENSITIVITY if sensitivity is None else sensitivity)
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
        min_hand_detection_confidence = float(MIN_DETECTION_CONFIDENCE),
        min_hand_presence_confidence  = 0.60,
        min_tracking_confidence       = float(MIN_TRACKING_CONFIDENCE),
        result_callback = on_result,
    )
    landmarker = HandLandmarker.create_from_options(options)

    paused     = False
    show_stats = True
    topmost    = True
    click_thru = True   # click-through ON by default so other apps still work
    fps_cnt    = 0
    fps_t      = time.perf_counter()
    fps_val    = 0
    conf       = 0
    gesture    = GSM.NONE
    frame_ms   = 0   # monotonic timestamp sent to MediaPipe

    # ── Key state shared between background key-reader and main loop ─────────
    # Using msvcrt (non-blocking) in a thread avoids cv2.waitKey stealing focus
    _key_queue = []
    _key_lock  = threading.Lock()
    _running   = [True]

    def _key_reader():
        """Background thread: reads keys via msvcrt without stealing focus."""
        while _running[0]:
            if msvcrt.kbhit():
                ch = msvcrt.getwch()
                with _key_lock:
                    _key_queue.append(ch.lower() if ch.isprintable() else ch)
            time.sleep(0.02)

    key_thread = threading.Thread(target=_key_reader, daemon=True)
    key_thread.start()

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
    set_click_through(WIN, click_thru)

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
    print("    Middle+Ring V up     → Scroll (move hand up / down)")
    print("    Full fist            → Pause cursor")
    print()
    print("  HOTKEYS (type in this terminal window):")
    print("    Q / ESC  →  Quit")
    print("    P        →  Pause / Resume")
    print("    + / -    →  Sensitivity up / down")
    print("    F        →  Toggle always-on-top")
    print("    C        →  Toggle click-through")
    print("               (ON = overlay never blocks other apps)")
    print()
    print("  CLICK-THROUGH is ON by default — the mini overlay")
    print("  floats above everything but NEVER steals clicks or focus.")
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
        sx = sy = None

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
            scroll_debug = gsm.get_scroll_debug() if gesture == GSM.SCRL else None

            if gesture in (GSM.MOVE, GSM.LCLK, GSM.RCLK, GSM.DRAG):
                pyautogui.moveTo(sx, sy, duration=0, _pause=False)

            # Draw cursor ring on index tip
            ix, iy = to_px(lms[INDEX_TIP], fw, fh)
            cv2.circle(frame, (ix, iy), 15, C_GREEN, 2, cv2.LINE_AA)

        else:
            if not paused:
                gsm.cleanup()
            scroll_debug = None
            if paused:
                gesture = GSM.PAUSE

        # ── HUD ──────────────────────────────────────────────────────────────
        if gesture == GSM.SCRL:
            draw_scroll_zones(frame)
        pinch_distance = None
        if lms is not None:
            pinch_distance = float(ldist(lms[THUMB_TIP], lms[INDEX_TIP]) / max(float(ldist(lms[0], lms[9])), 0.001))
        draw_hud(frame, gesture, conf, fps_val,
                 mapper.sensitivity, paused, show_stats, debug=debug_mode,
                 pinch_distance=pinch_distance, mouse_xy=(sx, sy), scroll_debug=scroll_debug)
        draw_flash(frame, gesture)
        cv2.imshow(WIN, frame)

        # ── Keys (read from background thread — no focus stealing) ───────────
        # cv2.waitKey(1) is still called to pump the OpenCV event loop
        # (needed for imshow to render) but we do NOT use its return value
        # for hotkeys, so the window never needs to be focused.
        cv2.waitKey(1)

        with _key_lock:
            keys = _key_queue[:]
            _key_queue.clear()

        for ch in keys:
            if   ch in ('q', '\x1b'):        # Q or ESC
                _running[0] = False
                gsm.cleanup(); landmarker.close(); cap.release()
                cv2.destroyAllWindows()
                print("\n  VirtualMouse stopped.")
                sys.exit(0)
            elif ch == 'p':
                paused = not paused
                if paused:
                    gsm.cleanup()
                    latest["landmarks"] = None
                print(f"  {'PAUSED' if paused else 'RESUMED'}")
            elif ch in ('+', '='):
                mapper.sensitivity = min(4.0, round(mapper.sensitivity + 0.1, 1))
                print(f"  Sensitivity → {mapper.sensitivity}")
            elif ch == '-':
                mapper.sensitivity = max(0.3, round(mapper.sensitivity - 0.1, 1))
                print(f"  Sensitivity → {mapper.sensitivity}")
            elif ch == 's':
                show_stats = not show_stats
            elif ch == 'f':
                topmost = not topmost
                set_topmost(WIN, topmost)
                print(f"  Always-on-top: {'ON' if topmost else 'OFF'}")
            elif ch == 'c':
                # Toggle click-through so you can interact with the overlay itself
                click_thru = not click_thru
                set_click_through(WIN, click_thru)
                print(f"  Click-through: {'ON (overlay transparent to clicks)' if click_thru else 'OFF (overlay clickable)'}")

    # ── Cleanup ───────────────────────────────────────────────────────────────
    _running[0] = False
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
    ap.add_argument("--sensitivity",  "-s",  type=float, default=SENSITIVITY)
    ap.add_argument("--alpha",        "-a",  type=float, default=SMOOTHING_FACTOR)
    ap.add_argument("--scroll-speed", "-sc", type=int,   default=5)
    ap.add_argument("--camera",       "-c",  type=int,   default=CAMERA_INDEX)
    ap.add_argument("--debug", action="store_true", default=DEBUG_MODE)
    args = ap.parse_args()
    run(args.sensitivity, args.alpha, args.scroll_speed, args.camera, debug_mode=args.debug)
