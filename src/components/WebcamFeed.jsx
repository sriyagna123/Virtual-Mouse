/**
 * WebcamFeed.jsx
 * Renders the webcam video with MediaPipe landmark overlay canvas.
 * Shows scan-line, corner decorations, FPS, confidence, and gesture badge.
 */

import React from 'react';

export default function WebcamFeed({
  videoRef,
  canvasRef,
  gesture,
  confidence,
  fps,
  isCameraOn,
  cameraError,
  handedness,
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '75%', // 4:3 aspect ratio
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#050810',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        boxShadow: '0 0 30px rgba(0, 212, 255, 0.1)',
      }}
    >
      {/* Inner absolute container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* ── Scan line animation ── */}
        {isCameraOn && <div className="scan-line" />}

        {/* ── Corner decorations ── */}
        <CornerDecoration position="top-left" />
        <CornerDecoration position="top-right" />
        <CornerDecoration position="bottom-left" />
        <CornerDecoration position="bottom-right" />

        {/* ── Video element ── */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            opacity: isCameraOn ? 1 : 0,
          }}
        />

        {/* ── Landmark overlay canvas ── */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            transform: 'scaleX(-1)',
          }}
        />

        {/* ── Camera off / error state ── */}
        {!isCameraOn && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(5, 8, 16, 0.9)',
              gap: '16px',
            }}
          >
            {cameraError ? (
              <>
                <div style={{ fontSize: '48px' }}>⚠️</div>
                <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '16px' }}>
                  Camera Access Denied
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', maxWidth: '260px' }}>
                  {cameraError}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Enable camera in browser settings and refresh.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '48px' }}>📷</div>
                <div style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '16px' }}>
                  Camera Ready
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Click "Start Camera" to begin
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HUD: Bottom bar ── */}
        {isCameraOn && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}
          >
            {/* Gesture badge */}
            <div className="gesture-badge">
              ✋ {gesture}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {handedness && (
                <HudStat label="Hand" value={handedness} color="#a78bfa" />
              )}
              <HudStat
                label="Conf"
                value={`${confidence}%`}
                color={confidence > 70 ? '#10b981' : confidence > 40 ? '#f59e0b' : '#ef4444'}
              />
              <HudStat label="FPS" value={fps} color="#10b981" mono />
            </div>
          </div>
        )}

        {/* ── HUD: Top bar ── */}
        {isCameraOn && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'rgba(0,212,255,0.6)', fontFamily: 'monospace' }}>
              LIVE ● MEDIAPIPE v0.4
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(0,212,255,0.6)', fontFamily: 'monospace' }}>
              640×480
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HudStat({ label, value, color, mono }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: mono ? '13px' : '12px',
          fontFamily: mono ? 'monospace' : 'inherit',
          fontWeight: '700',
          color,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function CornerDecoration({ position }) {
  const isTop = position.includes('top');
  const isLeft = position.includes('left');
  const size = 18;
  const offset = 8;

  return (
    <div
      style={{
        position: 'absolute',
        top: isTop ? offset : undefined,
        bottom: !isTop ? offset : undefined,
        left: isLeft ? offset : undefined,
        right: !isLeft ? offset : undefined,
        width: size,
        height: size,
        borderTop: isTop ? '2px solid rgba(0,212,255,0.6)' : 'none',
        borderBottom: !isTop ? '2px solid rgba(0,212,255,0.6)' : 'none',
        borderLeft: isLeft ? '2px solid rgba(0,212,255,0.6)' : 'none',
        borderRight: !isLeft ? '2px solid rgba(0,212,255,0.6)' : 'none',
        pointerEvents: 'none',
      }}
    />
  );
}
