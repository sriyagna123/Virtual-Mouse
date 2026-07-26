/**
 * LandingPage.jsx
 * Professional landing page explaining how the Virtual Mouse works.
 * Features: hero section, how-it-works, tech stack, CTA.
 */

import React from 'react';

const FEATURES = [
  { icon: '🖐', title: 'Hand Tracking', desc: 'Real-time 21-point hand skeleton detection via MediaPipe Hands at 30+ FPS.' },
  { icon: '🖱', title: 'Cursor Control', desc: 'Smooth cursor movement mapped from your index fingertip with configurable sensitivity.' },
  { icon: '🤏', title: 'Click Gestures', desc: 'Pinch gestures trigger left and right clicks with visual feedback and ripple effects.' },
  { icon: '📜', title: 'Scroll Control', desc: 'Two-finger V gesture enables natural scrolling in any direction.' },
  { icon: '🤖', title: 'AI Assistance', desc: 'IBM WatsonX AI (Llama 3.3 70B) provides real-time gesture tips and accessibility advice.' },
  { icon: '⚙', title: 'Calibration', desc: 'Custom workspace calibration adapts to any screen size and hand position.' },
];

const STEPS = [
  { step: '01', title: 'Grant Camera Access', desc: 'Allow the browser to access your webcam. Your video never leaves your device.' },
  { step: '02', title: 'Hand Detected', desc: 'MediaPipe Hands detects your hand and maps 21 landmarks in real time.' },
  { step: '03', title: 'Gesture Classified', desc: 'The app classifies your gesture (move, click, scroll) from finger positions.' },
  { step: '04', title: 'Mouse Action Fired', desc: 'The virtual cursor moves and clicks are fired as DOM events across the page.' },
];

const TECH = [
  { name: 'React 19', color: '#61dafb', icon: '⚛️' },
  { name: 'MediaPipe Hands', color: '#00d4ff', icon: '✋' },
  { name: 'IBM WatsonX AI', color: '#be4bdb', icon: '🤖' },
  { name: 'Tailwind CSS', color: '#06b6d4', icon: '🎨' },
  { name: 'Llama 3.3 70B', color: '#f59e0b', icon: '🦙' },
  { name: 'WebRTC', color: '#10b981', icon: '📷' },
];

export default function LandingPage({ onGetStarted }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflowX: 'hidden',
      }}
    >
      {/* ── Hero Section ── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 24px 40px',
          position: 'relative',
        }}
        className="hero-gradient grid-overlay"
      >
        {/* Background orbs */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '15%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#00d4ff',
            fontWeight: '600',
          }}
        >
          <span style={{ animation: 'pulseDot 1.5s ease infinite', width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff', display: 'inline-block' }} />
          Powered by IBM WatsonX AI
        </div>

        {/* Hero icon */}
        <div
          className="float-animation"
          style={{ fontSize: '80px', marginBottom: '24px', lineHeight: 1 }}
        >
          🖐
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(32px, 6vw, 72px)',
            fontWeight: '900',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            marginBottom: '16px',
            maxWidth: '800px',
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Control Your Computer
          </span>
          <br />
          <span style={{ color: 'var(--text-primary)' }}>With Your Hands</span>
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: 'var(--text-muted)',
            maxWidth: '560px',
            lineHeight: 1.7,
            marginBottom: '40px',
          }}
        >
          A futuristic touchless control system using real-time hand gesture recognition. 
          Move, click, and scroll — no hardware required.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onGetStarted}
            className="btn-primary"
            style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px' }}
          >
            🚀 Launch App
          </button>
          <a
            href="#how-it-works"
            className="btn-secondary"
            style={{
              padding: '14px 32px',
              fontSize: '16px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            📖 How It Works
          </a>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            marginTop: '60px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {[
            { value: '30+', label: 'FPS Real-time' },
            { value: '21', label: 'Hand Landmarks' },
            { value: '6', label: 'Gestures' },
            { value: 'AI', label: 'WatsonX Powered' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div className="neon-text-cyan" style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'monospace' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        id="how-it-works"
        style={{ padding: '80px 24px', maxWidth: '1000px', margin: '0 auto' }}
      >
        <SectionHeader
          badge="PIPELINE"
          title="How It Works"
          subtitle="From webcam to cursor control in milliseconds"
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginTop: '48px',
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={step.step}
              className="glass-card"
              style={{ padding: '24px', position: 'relative' }}
            >
              <div
                style={{
                  fontSize: '40px',
                  fontWeight: '900',
                  fontFamily: 'monospace',
                  background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                  marginBottom: '12px',
                }}
              >
                {step.step}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', margin: '0 0 8px' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                {step.desc}
              </p>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    right: '-14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(0,212,255,0.3)',
                    fontSize: '20px',
                    zIndex: 1,
                    display: window.innerWidth > 768 ? 'block' : 'none',
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <SectionHeader
            badge="FEATURES"
            title="Everything You Need"
            subtitle="Professional-grade touchless control in your browser"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginTop: '48px',
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass-card"
                style={{
                  padding: '24px',
                  transition: 'transform 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', margin: '0 0 8px', color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section style={{ padding: '80px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <SectionHeader
          badge="TECH STACK"
          title="Built With Modern Tools"
          subtitle="Industry-leading frameworks and AI models"
        />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '48px',
            justifyContent: 'center',
          }}
        >
          {TECH.map((t) => (
            <div
              key={t.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '30px',
                background: `${t.color}15`,
                border: `1px solid ${t.color}40`,
                fontSize: '14px',
                fontWeight: '600',
                color: t.color,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section
        style={{
          padding: '100px 24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.05), rgba(124,58,237,0.05))',
          borderTop: '1px solid var(--border-glass)',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(24px, 4vw, 48px)',
            fontWeight: '900',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Ready to Go Touchless?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginBottom: '32px' }}>
          No hardware, no installation. Just your webcam and hands.
        </p>
        <button
          onClick={onGetStarted}
          className="btn-primary"
          style={{ padding: '16px 48px', fontSize: '18px', borderRadius: '14px' }}
        >
          🚀 Start Now — It's Free
        </button>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: '24px',
          textAlign: 'center',
          borderTop: '1px solid var(--border-glass)',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        <div>VirtualMouse AI • Built with React, MediaPipe & IBM WatsonX</div>
        <div style={{ marginTop: '4px', opacity: 0.6 }}>
          © 2025 Virtual Mouse Project • Hand gesture data processed locally
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ badge, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-block',
          padding: '4px 14px',
          borderRadius: '20px',
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.3)',
          fontSize: '11px',
          fontWeight: '700',
          color: '#00d4ff',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}
      >
        {badge}
      </div>
      <h2
        style={{
          fontSize: 'clamp(24px, 4vw, 42px)',
          fontWeight: '800',
          marginBottom: '12px',
          letterSpacing: '-1px',
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto' }}>
        {subtitle}
      </p>
    </div>
  );
}
