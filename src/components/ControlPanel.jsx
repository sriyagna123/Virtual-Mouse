/**
 * ControlPanel.jsx
 * Left sidebar with:
 * - Start/stop camera button
 * - Sensitivity slider
 * - Calibration mode
 * - Click log
 */

import React, { useState } from 'react';

export default function ControlPanel({
  isCameraOn,
  onStartCamera,
  onStopCamera,
  sensitivity,
  onSensitivityChange,
  calibrationMode,
  onToggleCalibration,
  clickLog,
  trackingEnabled,
  onToggleTracking,
}) {
  const [showClickLog, setShowClickLog] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* ── Camera controls ── */}
      <PanelSection title="Camera Control" icon="📷">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={isCameraOn ? onStopCamera : onStartCamera}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              background: isCameraOn
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #00d4ff, #7c3aed)',
            }}
          >
            {isCameraOn ? '⏹ Stop Camera' : '▶ Start Camera'}
          </button>

          {isCameraOn && (
            <button
              onClick={onToggleTracking}
              className="btn-secondary"
              style={{ width: '100%', padding: '10px', fontSize: '13px' }}
            >
              {trackingEnabled ? '⏸ Pause Tracking' : '▶ Resume Tracking'}
            </button>
          )}
        </div>
      </PanelSection>

      {/* ── Sensitivity slider ── */}
      <PanelSection title="Cursor Sensitivity" icon="🎯">
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Slow</span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#00d4ff',
                fontFamily: 'monospace',
              }}
            >
              {sensitivity.toFixed(1)}×
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fast</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={sensitivity}
            onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '4px',
            }}
          >
            {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((v) => (
              <button
                key={v}
                onClick={() => onSensitivityChange(v)}
                style={{
                  background: Math.abs(sensitivity - v) < 0.05 ? 'rgba(0,212,255,0.2)' : 'transparent',
                  border: `1px solid ${Math.abs(sensitivity - v) < 0.05 ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4px',
                  color: Math.abs(sensitivity - v) < 0.05 ? '#00d4ff' : 'var(--text-muted)',
                  fontSize: '10px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </PanelSection>

      {/* ── Calibration mode ── */}
      <PanelSection title="Calibration" icon="📐">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
            Enable calibration to set custom boundaries for your workspace. Move your hand to all corners when active.
          </p>
          <button
            onClick={onToggleCalibration}
            className={calibrationMode ? 'btn-primary' : 'btn-secondary'}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              background: calibrationMode
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : undefined,
            }}
          >
            {calibrationMode ? '✓ Calibrating… Click to Save' : '⚙ Start Calibration'}
          </button>
          {calibrationMode && (
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '11px',
                color: '#f59e0b',
                lineHeight: '1.6',
              }}
            >
              🔶 Move your index finger to:
              <br />• Top-left corner
              <br />• Top-right corner
              <br />• Bottom-left corner
              <br />• Bottom-right corner
              <br />Then click "Save" above.
            </div>
          )}
        </div>
      </PanelSection>

      {/* ── Click log ── */}
      <PanelSection
        title={`Click Log (${clickLog.length})`}
        icon="🖱"
        collapsible
        collapsed={!showClickLog}
        onToggleCollapse={() => setShowClickLog(!showClickLog)}
      >
        {showClickLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
            {clickLog.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                No clicks yet
              </div>
            ) : (
              clickLog.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    color: c.type === 'left' ? '#00d4ff' : '#ec4899',
                  }}
                >
                  <span>{c.type === 'left' ? 'L' : 'R'} click</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {c.x},{c.y}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </PanelSection>
    </div>
  );
}

function PanelSection({ title, icon, children, collapsible, collapsed, onToggleCollapse }) {
  return (
    <div
      className="glass-card-sm"
      style={{ padding: '14px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: collapsed ? 0 : '12px',
          cursor: collapsible ? 'pointer' : 'default',
        }}
        onClick={collapsible ? onToggleCollapse : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>{icon}</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </span>
        </div>
        {collapsible && (
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}
