/**
 * VirtualCursor.jsx
 * Renders the custom virtual cursor overlay on top of the page.
 * The cursor tracks hand position and shows click animations.
 */

import React from 'react';

export default function VirtualCursor({ x, y, isLeftClicking, isRightClicking, visible }) {
  if (!visible) return null;

  const size = isLeftClicking || isRightClicking ? 32 : 24;
  const clickColor = isRightClicking ? '#ec4899' : '#00d4ff';

  return (
    <>
      {/* ── Outer ring ── */}
      <div
        id="virtual-cursor"
        style={{
          position: 'fixed',
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          pointerEvents: 'none',
          width: size + 12,
          height: size + 12,
          borderRadius: '50%',
          border: `2px solid ${clickColor}`,
          opacity: isLeftClicking || isRightClicking ? 1 : 0.6,
          boxShadow: isLeftClicking || isRightClicking
            ? `0 0 20px ${clickColor}, 0 0 40px ${clickColor}60`
            : `0 0 10px ${clickColor}60`,
          transition: 'width 0.1s ease, height 0.1s ease, box-shadow 0.1s ease',
        }}
      />

      {/* ── Inner dot ── */}
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          pointerEvents: 'none',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: clickColor,
          boxShadow: `0 0 8px ${clickColor}`,
          transition: 'background 0.1s ease',
        }}
      />

      {/* ── Click ripple effect ── */}
      {(isLeftClicking || isRightClicking) && (
        <div
          style={{
            position: 'fixed',
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
            zIndex: 9998,
            pointerEvents: 'none',
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `${clickColor}20`,
            border: `1px solid ${clickColor}40`,
            animation: 'rippleExpand 0.4s ease-out forwards',
          }}
        />
      )}

      <style>{`
        @keyframes rippleExpand {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </>
  );
}
