/**
 * FloatingCamera.jsx
 *
 * A always-visible, draggable, collapsible picture-in-picture camera widget.
 * It renders the webcam feed + landmark canvas overlay as a fixed-position
 * panel so it stays visible even when the user switches tabs, opens Chrome,
 * File Explorer, etc. — hand tracking never stops because the <video> keeps
 * playing and MediaPipe keeps receiving frames.
 *
 * States:
 *   expanded  – full 280×210 preview panel at bottom-right corner
 *   collapsed – slim 220×36 title bar only (save space, keep tracking alive)
 *
 * The user can also drag the widget anywhere on screen.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

export default function FloatingCamera({
  videoRef,
  canvasRef,
  gesture,
  confidence,
  fps,
  isCameraOn,
  serverConnected,
  onStartCamera,
  onStopCamera,
}) {
  // ── Collapse / expand ──────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(false);

  // ── Slide-in on mount ─────────────────────────────────────────────────────
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Small delay so the CSS transition plays on first render
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ── Drag logic ────────────────────────────────────────────────────────────
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  // Position stored as offset from bottom-right edge (to match CSS default)
  const [pos, setPos] = useState({ right: 20, bottom: 20 });

  const onMouseDown = useCallback((e) => {
    // Only drag on the title bar (not the close/collapse buttons)
    if (e.target.closest('[data-no-drag]')) return;
    dragging.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: rect.left,
      oy: rect.top,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      const newLeft = dragStart.current.ox + dx;
      const newTop  = dragStart.current.oy + dy;

      // Convert to right/bottom offset so it stays in place on resize
      const right  = window.innerWidth  - newLeft - containerRef.current.offsetWidth;
      const bottom = window.innerHeight - newTop  - containerRef.current.offsetHeight;

      setPos({
        right:  Math.max(-10, Math.min(window.innerWidth  - 60, right)),
        bottom: Math.max(-10, Math.min(window.innerHeight - 36, bottom)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  // ── Derived sizes ─────────────────────────────────────────────────────────
  const W          = 280;
  const H_EXPANDED = 210; // video area height
  const H_TITLE    = 38;
  const totalH     = collapsed ? H_TITLE : H_TITLE + H_EXPANDED + 34; // +34 for status bar

  // ── Confidence colour ─────────────────────────────────────────────────────
  const confColor =
    confidence > 70 ? '#10b981' : confidence > 40 ? '#f59e0b' : '#ef4444';

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      style={{
        position:    'fixed',
        right:       pos.right,
        bottom:      pos.bottom,
        width:       W,
        height:      totalH,
        zIndex:      9990,
        borderRadius: 14,
        overflow:    'hidden',
        cursor:      'grab',
        userSelect:  'none',
        background:  'rgba(8, 12, 24, 0.92)',
        border:      `1px solid ${serverConnected ? 'rgba(0,212,255,0.35)' : 'rgba(239,68,68,0.35)'}`,
        boxShadow:   serverConnected
          ? '0 8px 40px rgba(0,212,255,0.18), 0 2px 10px rgba(0,0,0,0.6)'
          : '0 8px 40px rgba(239,68,68,0.12), 0 2px 10px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        // Slide up from below on mount
        transform:   visible ? 'translateY(0)' : 'translateY(120px)',
        opacity:     visible ? 1 : 0,
        transition:  'transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease, height 0.3s cubic-bezier(0.22,1,0.36,1), border-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* ── Title bar ──────────────────────────────────────────────────── */}
      <div
        style={{
          height:      H_TITLE,
          display:     'flex',
          alignItems:  'center',
          padding:     '0 10px',
          gap:         8,
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          flexShrink:  0,
        }}
      >
        {/* Live dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background:  isCameraOn ? '#10b981' : '#6b7280',
          boxShadow:   isCameraOn ? '0 0 6px #10b981' : 'none',
          animation:   isCameraOn ? 'pulseDot 1.5s ease infinite' : 'none',
        }} />

        {/* Label */}
        <span style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 700,
          color: isCameraOn ? '#00d4ff' : 'var(--text-muted)',
          letterSpacing: '0.3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {isCameraOn
            ? `✋ ${gesture || 'Tracking…'}`
            : '📷 Camera Off'}
        </span>

        {/* FPS chip */}
        {isCameraOn && !collapsed && (
          <span style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
            color: '#10b981', background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 4, padding: '1px 5px',
          }}>
            {fps} fps
          </span>
        )}

        {/* System mouse status */}
        <span
          data-no-drag="1"
          style={{
            fontSize: 10, fontWeight: 700,
            color: serverConnected ? '#10b981' : '#ef4444',
            background: serverConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${serverConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 4, padding: '1px 6px', flexShrink: 0,
          }}
          title={serverConnected ? 'System mouse active' : 'Start python server/mouse_server.py'}
        >
          {serverConnected ? '🖥 SYS' : '⚠ OFF'}
        </span>

        {/* Collapse / expand toggle */}
        <button
          data-no-drag="1"
          onClick={() => setCollapsed(c => !c)}
          style={iconBtnStyle}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▲' : '▼'}
        </button>

        {/* Camera toggle */}
        <button
          data-no-drag="1"
          onClick={isCameraOn ? onStopCamera : onStartCamera}
          style={{
            ...iconBtnStyle,
            color: isCameraOn ? '#ef4444' : '#10b981',
            borderColor: isCameraOn ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)',
          }}
          title={isCameraOn ? 'Stop camera' : 'Start camera'}
        >
          {isCameraOn ? '⏹' : '▶'}
        </button>
      </div>

      {/* ── Video panel (hidden when collapsed) ────────────────────────── */}
      {!collapsed && (
        <>
          <div style={{
            position: 'relative',
            width:    W,
            height:   H_EXPANDED,
            overflow: 'hidden',
            background: '#050810',
            flexShrink: 0,
          }}>
            {/* Scan line */}
            {isCameraOn && (
              <div style={{
                position: 'absolute', width: '100%', height: 2, zIndex: 2, pointerEvents: 'none',
                background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)',
                animation: 'scanLine 3s linear infinite',
              }} />
            )}

            {/* Corner brackets */}
            {['tl','tr','bl','br'].map(c => <Bracket key={c} corner={c} />)}

            {/* ── video ── note: the same ref as in the main app ── */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                opacity: isCameraOn ? 1 : 0,
              }}
            />

            {/* ── landmark canvas ── */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                pointerEvents: 'none',
                transform: 'scaleX(-1)',
              }}
            />

            {/* Off-state overlay */}
            {!isCameraOn && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(5,8,16,0.92)', gap: 8,
              }}>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click ▶ to start</div>
              </div>
            )}
          </div>

          {/* ── Status bar ───────────────────────────────────────────── */}
          <div style={{
            height: 34, display: 'flex', alignItems: 'center',
            padding: '0 10px', gap: 10,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}>
            {/* Confidence bar */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: confColor, fontWeight: 700 }}>
                  {confidence}%
                </span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2, width: `${confidence}%`,
                  background: `linear-gradient(90deg, ${confColor}, #00d4ff)`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Drag hint */}
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', userSelect: 'none', flexShrink: 0 }}>
              ⠿ drag
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tiny icon button style ─────────────────────────────────────────────────
const iconBtnStyle = {
  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 10, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  padding: 0, transition: 'background 0.15s ease',
};

// ── Corner bracket decoration ─────────────────────────────────────────────
function Bracket({ corner }) {
  const isT = corner[0] === 't', isL = corner[1] === 'l';
  const sz = 12, off = 5;
  return (
    <div style={{
      position: 'absolute', zIndex: 3, pointerEvents: 'none',
      top:    isT ? off : undefined,
      bottom: !isT ? off : undefined,
      left:   isL ? off : undefined,
      right:  !isL ? off : undefined,
      width: sz, height: sz,
      borderTop:    isT ? '1.5px solid rgba(0,212,255,0.7)' : 'none',
      borderBottom: !isT ? '1.5px solid rgba(0,212,255,0.7)' : 'none',
      borderLeft:   isL ? '1.5px solid rgba(0,212,255,0.7)' : 'none',
      borderRight:  !isL ? '1.5px solid rgba(0,212,255,0.7)' : 'none',
    }} />
  );
}
