/**
 * Header.jsx
 * Top navigation bar with logo, connection status, dark/light toggle.
 */

import React from 'react';

export default function Header({ theme, onToggleTheme, isConnected, isCameraOn }) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-glass)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          🖐
        </div>
        <div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #00d4ff, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            VirtualMouse AI
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '-2px' }}>
            Powered by IBM WatsonX
          </div>
        </div>
      </div>

      {/* Center: Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <StatusPill
          label="Camera"
          active={isCameraOn}
          activeColor="#10b981"
          icon="📷"
        />
        <StatusPill
          label="AI Engine"
          active={isConnected}
          activeColor="#00d4ff"
          icon="🤖"
        />
        <StatusPill
          label="Tracking"
          active={isCameraOn}
          activeColor="#a78bfa"
          icon="✋"
        />
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}

function StatusPill({ label, active, activeColor, icon }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '20px',
        background: active ? `${activeColor}15` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? activeColor + '40' : 'var(--border-glass)'}`,
        transition: 'all 0.3s ease',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: active ? activeColor : '#6b7280',
          boxShadow: active ? `0 0 6px ${activeColor}` : 'none',
          animation: active ? 'pulseDot 1.5s ease infinite' : 'none',
        }}
      />
      <span style={{ fontSize: '11px', color: active ? activeColor : 'var(--text-muted)', fontWeight: '600' }}>
        {icon} {label}
      </span>
    </div>
  );
}
