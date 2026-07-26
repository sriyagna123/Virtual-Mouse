/**
 * VirtualMouseApp.jsx
 * Main application workspace.
 *
 * Two-mode mouse control:
 *  1. System mode  – sends normalised coords to Python mouse_server.py
 *                    via WebSocket → pyautogui moves the REAL OS cursor.
 *  2. Browser mode – virtual cursor overlay (fallback when server is offline).
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Header from './Header';
import ControlPanel from './ControlPanel';
import GestureGuide from './GestureGuide';
import FloatingCamera from './FloatingCamera';
import VirtualCursor from './VirtualCursor';
import { useHandTracking } from '../hooks/useHandTracking';
import { useVirtualMouse } from '../hooks/useVirtualMouse';
import { useSystemMouse } from '../hooks/useSystemMouse';
import { useWatsonX } from '../hooks/useWatsonX';

export default function VirtualMouseApp({ theme, onToggleTheme }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ── App state ──
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [, setCameraError] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState(1.5);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibration, setCalibration] = useState(null);

  // ── Session stats ──
  const [gestureCount, setGestureCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const gestureHistoryRef = useRef([]);

  // ── WatsonX AI ──
  const {
    aiTip,
    aiLoading,
    aiError,
    requestGestureTip,
    requestWelcomeMessage,
  } = useWatsonX();

  // ── System mouse: WebSocket → Python → pyautogui (real OS cursor) ──
  const {
    connected: serverConnected,
    serverInfo,
    error: serverError,
    sendMove,
    sendLeftClick,
    sendRightClick,
    sendDragStart,
    sendDragEnd,
    sendScroll,
  } = useSystemMouse();

  // ── Browser overlay cursor (fallback / visual feedback) ──
  const {
    cursorPos,
    isLeftClicking,
    isRightClicking,
    clickLog,
    moveCursor,
    performLeftClick,
    performRightClick,
    performScrollUp,
    performScrollDown,
  } = useVirtualMouse();

  // ── Hand tracking ──
  const {
    gesture,
    confidence,
    fps,
    setGestureCallbacks,
  } = useHandTracking(videoRef, canvasRef, {
    enabled: isCameraOn && trackingEnabled,
    sensitivity,
    calibration,
  });

  // ── Wire gesture callbacks → system mouse + browser overlay ──
  useEffect(() => {
    setGestureCallbacks({
      onMove: ({ normX, normY }) => {
        sendMove(normX, normY);
        moveCursor({ normX, normY });
      },
      onLeftClick: () => {
        sendLeftClick();
        performLeftClick();
        setClickCount((c) => c + 1);
      },
      onRightClick: () => {
        sendRightClick();
        performRightClick();
        setClickCount((c) => c + 1);
      },
      onDragStart: () => {
        sendDragStart();
      },
      onDragEnd: () => {
        sendDragEnd();
      },
      onScrollUp: (amt = 3) => {
        sendScroll('up', amt);
        performScrollUp();
      },
      onScrollDown: (amt = 3) => {
        sendScroll('down', amt);
        performScrollDown();
      },
    });
  }, [
    setGestureCallbacks,
    sendMove, sendLeftClick, sendRightClick, sendDragStart, sendDragEnd, sendScroll,
    moveCursor, performLeftClick, performRightClick, performScrollUp, performScrollDown,
  ]);

  // ── Track unique gestures ──
  useEffect(() => {
    if (gesture && gesture !== 'No hand detected' && gesture !== 'Unknown') {
      setGestureCount((c) => c + 1);
      gestureHistoryRef.current = [...gestureHistoryRef.current.slice(-9), gesture];

      // Request AI tip every ~20 gesture changes
      if (gestureCount % 20 === 0 && gestureCount > 0) {
        requestGestureTip(gesture, {
          fps,
          confidence,
          gestureHistory: gestureHistoryRef.current,
        });
      }
    }
  }, [gesture, fps, confidence, gestureCount, requestGestureTip]);

  // ── Request welcome message on mount ──
  useEffect(() => {
    requestWelcomeMessage();
  }, [requestWelcomeMessage]);

  // ── Start camera ──
  const handleStartCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraOn(true);
    } catch (err) {
      console.error('[Camera]', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission was denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  }, []);

  // ── Stop camera ──
  const handleStopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  // ── Calibration toggle ──
  const handleToggleCalibration = useCallback(() => {
    if (calibrationMode) {
      // Save calibration — in real impl we'd collect corner points
      setCalibration({ xMin: 0.1, xMax: 0.9, yMin: 0.1, yMax: 0.9 });
      setCalibrationMode(false);
    } else {
      setCalibrationMode(true);
    }
  }, [calibrationMode]);

  const sessionStats = {
    fps,
    confidence,
    gestureCount,
    clickCount,
    currentGesture: gesture,
    gestureHistory: gestureHistoryRef.current,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="grid-overlay"
    >
      {/* ── Header ── */}
      <Header
        theme={theme}
        onToggleTheme={onToggleTheme}
        isConnected={serverConnected}
        isCameraOn={isCameraOn}
        serverError={serverError}
        serverInfo={serverInfo}
      />

      {/* ── Main layout: two columns when camera is floating ── */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '20px',
          padding: '80px 20px 20px',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          alignItems: 'start',
        }}
      >
        {/* ── Left: Control Panel ── */}
        <aside style={{ position: 'sticky', top: '80px' }}>
          <ControlPanel
            isCameraOn={isCameraOn}
            onStartCamera={handleStartCamera}
            onStopCamera={handleStopCamera}
            sensitivity={sensitivity}
            onSensitivityChange={setSensitivity}
            calibrationMode={calibrationMode}
            onToggleCalibration={handleToggleCalibration}
            clickLog={clickLog}
            trackingEnabled={trackingEnabled}
            onToggleTracking={() => setTrackingEnabled((v) => !v)}
          />
        </aside>

        {/* ── Right: stats + gesture guide ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Active gesture + stat bar ── */}
          <div
            className="glass-card"
            style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                Active Gesture
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg, #00d4ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {gesture}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <QuickStat label="Cursor X" value={`${Math.round(cursorPos.x)}px`} />
              <QuickStat label="Cursor Y" value={`${Math.round(cursorPos.y)}px`} />
              <QuickStat label="Sensitivity" value={`${sensitivity.toFixed(1)}×`} color="#a78bfa" />
              <div style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                background: serverConnected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${serverConnected ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                color: serverConnected ? '#10b981' : '#ef4444',
              }}>
                {serverConnected ? '🖥 System Mouse: ON' : '⚠ Server Offline'}
              </div>
              {calibrationMode && (
                <div style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '12px', fontWeight: '600', color: '#f59e0b', animation: 'pulseDot 1s ease infinite' }}>
                  ⚙ CALIBRATING
                </div>
              )}
            </div>
          </div>

          {/* ── Server offline banner ── */}
          {!serverConnected && (
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: '700', color: '#ef4444', marginBottom: '4px', fontSize: '13px' }}>Python Mouse Server Not Running</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                  To control your <strong style={{ color: 'var(--text-primary)' }}>real OS cursor</strong>, run:
                </div>
                <div style={{ marginTop: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '12px', color: '#10b981', border: '1px solid rgba(255,255,255,0.08)' }}>
                  python server/mouse_server.py
                </div>
              </div>
            </div>
          )}

          {/* ── Gesture Guide + AI panel ── */}
          <GestureGuide
            aiTip={aiTip}
            aiLoading={aiLoading}
            aiError={aiError}
            sessionStats={sessionStats}
          />
        </section>
      </main>

      {/* ── Floating camera widget (always-visible, draggable) ── */}
      <FloatingCamera
        videoRef={videoRef}
        canvasRef={canvasRef}
        gesture={gesture}
        confidence={confidence}
        fps={fps}
        isCameraOn={isCameraOn}
        serverConnected={serverConnected}
        onStartCamera={handleStartCamera}
        onStopCamera={handleStopCamera}
      />

      {/* ── Virtual Cursor overlay ── */}
      <VirtualCursor
        x={cursorPos.x}
        y={cursorPos.y}
        isLeftClicking={isLeftClicking}
        isRightClicking={isRightClicking}
        visible={isCameraOn && trackingEnabled}
      />

      {/* ── Calibration overlay ── */}
      {calibrationMode && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 500, border: '3px dashed rgba(245,158,11,0.5)' }}>
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
            <CalibrationCornerTarget key={corner} corner={corner} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value, color = '#00d4ff' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '14px', fontWeight: '700', color, fontFamily: 'monospace' }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function CalibrationCornerTarget({ corner }) {
  const isTop = corner.includes('top');
  const isLeft = corner.includes('left');
  return (
    <div
      style={{
        position: 'absolute',
        top: isTop ? '40px' : undefined,
        bottom: !isTop ? '40px' : undefined,
        left: isLeft ? '40px' : undefined,
        right: !isLeft ? '40px' : undefined,
        width: '40px',
        height: '40px',
        border: '2px solid rgba(245,158,11,0.8)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(245,158,11,0.1)',
        animation: 'pulseDot 1.5s ease infinite',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#f59e0b',
        }}
      />
    </div>
  );
}
