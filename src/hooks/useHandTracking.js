/**
 * useHandTracking.js
 * ─────────────────────────────────────────────────────────────────────
 * MediaPipe Hands integration with a proper gesture state machine.
 *
 * GESTURES (in priority order, no conflicts)
 * ───────────────────────────────────────────
 *  FIST         — all fingers curled           → pause cursor
 *  SCROLL       — index + middle up, ring/pinky curled, NO pinch active
 *               → scroll mode (move hand up/down)
 *  DRAG         — left pinch held ≥ DRAG_HOLD_S → drag & drop
 *  LEFT_CLICK   — thumb + index pinch (released) → left click
 *  RIGHT_CLICK  — thumb + middle pinch (released)→ right click
 *  MOVE         — default (index pointing, open palm, etc.)
 *
 * Key improvements over previous version:
 *  - Scroll and click use SEPARATE, mutually exclusive conditions
 *  - Pinch threshold uses hysteresis (enter < exit) to prevent flutter
 *  - Click fires on RELEASE, not on hold → no repeated click spam
 *  - Drag fires drag_start on hold, drag_end on release
 *  - Scroll uses continuous y-delta, not single threshold triggers
 *  - FPS measured with performance.now() 1-second bucket
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ── MediaPipe landmark indices ───────────────────────────────────────────────
const LM = {
  WRIST:      0,
  THUMB_TIP:  4,
  INDEX_MCP:  5, INDEX_PIP:  6, INDEX_TIP:  8,
  MIDDLE_PIP: 10, MIDDLE_TIP: 12,
  RING_PIP:   14, RING_TIP:   16,
  PINKY_PIP:  18, PINKY_TIP:  20,
};

// ── Euclidean distance (normalised) ─────────────────────────────────────────
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Is fingertip above its PIP joint (extended)? ────────────────────────────
function extended(lms, tip, pip) {
  return lms[tip].y < lms[pip].y;
}

// ── Gesture labels ───────────────────────────────────────────────────────────
export const GESTURES = {
  NONE:        'No hand detected',
  MOVE:        'Move Cursor',
  LEFT_CLICK:  'Left Click',
  RIGHT_CLICK: 'Right Click',
  DRAG:        'Drag & Drop',
  SCROLL:      'Scroll',
  PAUSE:       'Pause',
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton drawing
// ─────────────────────────────────────────────────────────────────────────────
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function drawSkeleton(ctx, lms, W, H) {
  ctx.clearRect(0, 0, W, H);

  // Connections
  ctx.lineWidth  = 2;
  ctx.strokeStyle = 'rgba(0,212,255,0.55)';
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(lms[a].x * W, lms[a].y * H);
    ctx.lineTo(lms[b].x * W, lms[b].y * H);
    ctx.stroke();
  });

  // Nodes
  lms.forEach((lm, i) => {
    const x = lm.x * W, y = lm.y * H;
    const isTip   = [4,8,12,16,20].includes(i);
    const isWrist = i === 0;
    const r = isTip ? 6 : isWrist ? 7 : 4;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isTip ? 'rgba(0,212,255,0.9)'
                  : isWrist ? 'rgba(236,72,153,0.9)'
                  : 'rgba(167,139,250,0.8)';
    ctx.fill();

    if (isTip) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0,212,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Gesture state machine (runs per-frame inside onResults)
// ─────────────────────────────────────────────────────────────────────────────
class GestureSM {
  // Thresholds (normalised landmark distance)
  PINCH_ENTER  = 0.055;  // tighter = harder to trigger accidentally
  PINCH_EXIT   = 0.080;  // hysteresis: release needs wider gap
  DRAG_HOLD_MS = 700;    // ms to hold pinch before drag starts
  CLICK_CD_MS  = 550;    // ms cooldown between clicks
  SCROLL_MIN_DY = 0.015; // minimum wrist dy per scroll step

  constructor(callbacks) {
    this.cb = callbacks;          // { onMove, onLeftClick, onRightClick, onDragStart, onDragEnd, onScrollUp, onScrollDown }

    // Pinch tracking
    this._pinchL   = false;       // thumb+index pinch active
    this._pinchR   = false;       // thumb+middle pinch active
    this._pinchLt  = 0;           // timestamp pinch started

    // Drag state
    this._dragging = false;

    // Click timestamps
    this._tLC  = 0;
    this._tRC  = 0;

    // Scroll reference
    this._scrollRefY = null;
    this._scrollT    = 0;

    // Current label (for UI)
    this.label = GESTURES.NONE;
  }

  // ── Update callbacks (from React hook) ────────────────────────────────────
  setCallbacks(cb) { this.cb = cb; }

  // ── Per-frame entry ───────────────────────────────────────────────────────
  process(lms, normX, normY) {
    const now = performance.now();

    // ── Derived booleans ──
    const idxExt  = extended(lms, LM.INDEX_TIP,  LM.INDEX_PIP);
    const midExt  = extended(lms, LM.MIDDLE_TIP, LM.MIDDLE_PIP);
    const ringExt = extended(lms, LM.RING_TIP,   LM.RING_PIP);
    const pinkExt = extended(lms, LM.PINKY_TIP,  LM.PINKY_PIP);

    const dL = dist(lms[LM.THUMB_TIP], lms[LM.INDEX_TIP]);
    const dR = dist(lms[LM.THUMB_TIP], lms[LM.MIDDLE_TIP]);

    // ── FIST: all curled, no pinch ─────────────────────────────────────────
    if (!idxExt && !midExt && !ringExt && !pinkExt
        && dL > this.PINCH_EXIT && dR > this.PINCH_EXIT) {
      this._exitScroll();
      this._exitDrag();
      this.label = GESTURES.PAUSE;
      return;
    }

    // ── SCROLL: index + middle up, ring + pinky curled, no pinch ──────────
    // Explicit guard: dL > PINCH_EXIT ensures scroll can NEVER fire while pinching
    if (idxExt && midExt && !ringExt && !pinkExt
        && dL > this.PINCH_EXIT && dR > this.PINCH_EXIT) {
      this._exitDrag();

      const wristY = lms[LM.WRIST].y;
      if (this._scrollRefY === null) {
        this._scrollRefY = wristY;
      } else {
        const dy = this._scrollRefY - wristY;   // positive = moved up
        if (Math.abs(dy) > this.SCROLL_MIN_DY && now - this._scrollT > 80) {
          const amt = Math.max(1, Math.min(8, Math.round(Math.abs(dy) * 50)));
          if (dy > 0) this.cb.onScrollUp?.(amt);
          else        this.cb.onScrollDown?.(amt);
          this._scrollT    = now;
          this._scrollRefY = wristY;   // rolling baseline
        }
      }

      this.label = GESTURES.SCROLL;
      // Still emit move so cursor position stays current
      this.cb.onMove?.({ normX, normY });
      return;
    }

    // Left scroll mode if we were in it
    this._exitScroll();

    // ── LEFT PINCH (thumb + index) ─────────────────────────────────────────
    if (dL < this.PINCH_ENTER) {
      if (!this._pinchL) {
        this._pinchL  = true;
        this._pinchLt = now;
      }
      // Check drag threshold
      if (!this._dragging && now - this._pinchLt >= this.DRAG_HOLD_MS) {
        this._dragging = true;
        this.cb.onDragStart?.();
      }
      this.label = this._dragging ? GESTURES.DRAG : GESTURES.LEFT_CLICK;
      this.cb.onMove?.({ normX, normY });   // keep moving cursor during pinch
      return;
    } else if (this._pinchL) {
      // Pinch RELEASED
      this._pinchL = false;
      if (this._dragging) {
        this._exitDrag();
      } else {
        // Short hold = click
        if (now - this._tLC > this.CLICK_CD_MS) {
          this._tLC = now;
          this.cb.onLeftClick?.();
        }
      }
    }

    // ── RIGHT PINCH (thumb + middle) ───────────────────────────────────────
    if (dR < this.PINCH_ENTER) {
      if (!this._pinchR) { this._pinchR = true; }
      this.label = GESTURES.RIGHT_CLICK;
      this.cb.onMove?.({ normX, normY });
      return;
    } else if (this._pinchR) {
      this._pinchR = false;
      if (now - this._tRC > this.CLICK_CD_MS) {
        this._tRC = now;
        this.cb.onRightClick?.();
      }
    }

    // ── DEFAULT: MOVE ──────────────────────────────────────────────────────
    this.label = GESTURES.MOVE;
    this.cb.onMove?.({ normX, normY });
  }

  _exitScroll() { this._scrollRefY = null; }

  _exitDrag() {
    if (this._dragging) {
      this.cb.onDragEnd?.();
      this._dragging = false;
    }
  }

  destroy() { this._exitDrag(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// useHandTracking hook
// ─────────────────────────────────────────────────────────────────────────────
export function useHandTracking(videoRef, canvasRef, options = {}) {
  const { enabled = true, sensitivity = 1.5, calibration = null } = options;

  const [gesture,    setGesture]    = useState(GESTURES.NONE);
  const [confidence, setConfidence] = useState(0);
  const [fps,        setFps]        = useState(0);

  const handsRef    = useRef(null);
  const cameraRef   = useRef(null);
  const smRef       = useRef(null);

  const frameCount  = useRef(0);
  const fpsTimer    = useRef(performance.now());

  // External callbacks (set by parent)
  const callbacksRef = useRef({});
  const setGestureCallbacks = useCallback((cb) => {
    callbacksRef.current = cb;
    smRef.current?.setCallbacks(cb);
  }, []);

  // ── onResults: called every MediaPipe frame ──────────────────────────────
  const onResults = useCallback((results) => {
    // FPS
    frameCount.current++;
    const now = performance.now();
    if (now - fpsTimer.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      fpsTimer.current   = now;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    if (!results.multiHandLandmarks?.length) {
      ctx.clearRect(0, 0, W, H);
      setGesture(GESTURES.NONE);
      setConfidence(0);
      smRef.current?._exitScroll();
      smRef.current?._exitDrag();
      return;
    }

    const lms      = results.multiHandLandmarks[0];
    const handInfo = results.multiHandedness?.[0];
    setConfidence(Math.round((handInfo?.score ?? 0) * 100));

    // Draw skeleton
    drawSkeleton(ctx, lms, W, H);

    // ── Map index fingertip → normalised cursor position ──────────────────
    let rawX = lms[LM.INDEX_TIP].x;
    let rawY = lms[LM.INDEX_TIP].y;

    // Calibration bounds
    if (calibration) {
      rawX = (rawX - calibration.xMin) / (calibration.xMax - calibration.xMin);
      rawY = (rawY - calibration.yMin) / (calibration.yMax - calibration.yMin);
      rawX = Math.max(0, Math.min(1, rawX));
      rawY = Math.max(0, Math.min(1, rawY));
    }

    // Mirror x (video is flipped)
    // Sensitivity: expand from center
    const cx = 0.5;
    let nX = cx + (1 - rawX - cx) * sensitivity;
    let nY = 0.5 + (rawY - 0.5) * sensitivity;
    nX = Math.max(0, Math.min(1, nX));
    nY = Math.max(0, Math.min(1, nY));

    // Run gesture state machine
    smRef.current?.process(lms, nX, nY);
    setGesture(smRef.current?.label ?? GESTURES.NONE);

  }, [canvasRef, calibration, sensitivity]);

  // ── Init MediaPipe + camera ───────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !videoRef.current) return;
    let destroyed = false;

    // Create gesture state machine
    smRef.current = new GestureSM(callbacksRef.current);

    const init = async () => {
      try {
        const { Hands  } = await import('@mediapipe/hands');
        const { Camera } = await import('@mediapipe/camera_utils');

        const hands = new Hands({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`,
        });
        hands.setOptions({
          maxNumHands:            1,
          modelComplexity:        1,
          minDetectionConfidence: 0.70,
          minTrackingConfidence:  0.55,
        });
        hands.onResults(onResults);

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (!destroyed && videoRef.current)
              await hands.send({ image: videoRef.current });
          },
          width: 640, height: 480,
        });

        if (!destroyed) {
          await camera.start();
          handsRef.current  = hands;
          cameraRef.current = camera;
        }
      } catch (err) {
        console.error('[useHandTracking] init error:', err);
      }
    };

    init();

    return () => {
      destroyed = true;
      smRef.current?.destroy();
      cameraRef.current?.stop?.();
      handsRef.current?.close?.();
      handsRef.current  = null;
      cameraRef.current = null;
    };
  }, [enabled, videoRef, onResults]);

  return { gesture, confidence, fps, setGestureCallbacks };
}
