/**
 * GestureGuide.jsx
 * Right sidebar showing:
 * - Full gesture reference card
 * - WatsonX AI tips panel
 * - Session stats
 */

import React from 'react';

const GESTURES = [
  {
    emoji: '☝️',
    name: 'Move Cursor',
    description: 'Extend index finger and point. Cursor follows fingertip smoothly.',
    color: '#00d4ff',
    shortcut: 'Index finger pointing',
    matchLabel: 'Move Cursor',
  },
  {
    emoji: '🤏',
    name: 'Left Click',
    description: 'Pinch thumb + index together, then release. Fires on release.',
    color: '#10b981',
    shortcut: 'Thumb + Index pinch → release',
    matchLabel: 'Left Click',
  },
  {
    emoji: '🤞',
    name: 'Right Click',
    description: 'Pinch thumb + middle finger together, then release.',
    color: '#ec4899',
    shortcut: 'Thumb + Middle pinch → release',
    matchLabel: 'Right Click',
  },
  {
    emoji: '✊',
    name: 'Drag & Drop',
    description: 'Hold thumb + index pinch for 0.7s to begin dragging. Release to drop.',
    color: '#f59e0b',
    shortcut: 'Hold pinch 0.7s → drag → release',
    matchLabel: 'Drag & Drop',
  },
  {
    emoji: '✌️',
    name: 'Scroll',
    description: 'Raise index + middle fingers (ring/pinky curled). Move hand up = scroll up, down = scroll down.',
    color: '#a78bfa',
    shortcut: 'Index + Middle up — move hand',
    matchLabel: 'Scroll',
  },
  {
    emoji: '✊',
    name: 'Pause',
    description: 'Close fist completely (all fingers curled, no pinch) to freeze cursor.',
    color: '#6b7280',
    shortcut: 'Full fist — all fingers curled',
    matchLabel: 'Pause',
  },
];

export default function GestureGuide({ aiTip, aiLoading, aiError, sessionStats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── WatsonX AI Assistant ── */}
      <div
        className="glass-card-sm watson-panel"
        style={{ padding: '14px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #00d4ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa' }}>
              WatsonX AI Assistant
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Llama 3.3 70B • IBM Cloud EU-DE
            </div>
          </div>
          {aiLoading && (
            <div
              style={{
                marginLeft: 'auto',
                width: '16px',
                height: '16px',
                border: '2px solid rgba(124,58,237,0.3)',
                borderTopColor: '#7c3aed',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
        </div>

        <div
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.2)',
            minHeight: '60px',
          }}
        >
          {aiError ? (
            <div style={{ fontSize: '12px', color: '#ef4444' }}>⚠️ {aiError}</div>
          ) : aiLoading ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Thinking…
            </div>
          ) : aiTip ? (
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
              💡 {aiTip}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              AI tips will appear here as you use gestures.
            </div>
          )}
        </div>
      </div>

      {/* ── Session Statistics ── */}
      <div className="glass-card-sm" style={{ padding: '14px' }}>
        <SectionTitle icon="📊" title="Session Stats" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginTop: '10px',
          }}
        >
          <StatBox label="FPS" value={sessionStats.fps} color="#10b981" />
          <StatBox label="Confidence" value={`${sessionStats.confidence}%`} color="#00d4ff" />
          <StatBox label="Gestures" value={sessionStats.gestureCount} color="#a78bfa" />
          <StatBox label="Clicks" value={sessionStats.clickCount} color="#ec4899" />
        </div>

        {/* Confidence bar */}
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Detection Confidence</span>
            <span style={{ fontSize: '11px', color: '#00d4ff', fontWeight: '600' }}>
              {sessionStats.confidence}%
            </span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
            <div
              className="confidence-bar"
              style={{ width: `${sessionStats.confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Gesture Reference ── */}
      <div className="glass-card-sm" style={{ padding: '14px' }}>
        <SectionTitle icon="✋" title="Gesture Reference" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {GESTURES.map((g) => (
            <GestureCard key={g.name} gesture={g} currentGesture={sessionStats.currentGesture} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GestureCard({ gesture, currentGesture }) {
  const isActive = gesture.matchLabel
    ? currentGesture === gesture.matchLabel
    : currentGesture?.includes(gesture.name.split(' ')[0]);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '8px',
        borderRadius: '8px',
        background: isActive ? `${gesture.color}15` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isActive ? gesture.color + '40' : 'transparent'}`,
        transition: 'all 0.3s ease',
      }}
    >
      <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>{gesture.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: '700',
            color: isActive ? gesture.color : 'var(--text-primary)',
            transition: 'color 0.3s ease',
          }}
        >
          {gesture.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
          {gesture.description}
        </div>
        <div
          style={{
            marginTop: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: gesture.color,
            opacity: 0.8,
          }}
        >
          {gesture.shortcut}
        </div>
      </div>
      {isActive && (
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: gesture.color,
            boxShadow: `0 0 6px ${gesture.color}`,
            animation: 'pulseDot 1s ease infinite',
            flexShrink: 0,
            marginTop: '4px',
          }}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div
      style={{
        padding: '8px',
        borderRadius: '8px',
        background: `${color}10`,
        border: `1px solid ${color}25`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '18px', fontWeight: '700', color, fontFamily: 'monospace' }}>
        {value ?? 0}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </span>
    </div>
  );
}
