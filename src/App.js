/**
 * App.js
 * Root component: handles theme state and routing between
 * the landing page and the main virtual mouse application.
 */

import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import VirtualMouseApp from './components/VirtualMouseApp';
import './index.css';

export default function App() {
  // ── Theme: persisted in localStorage ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vm-theme') || 'dark';
  });

  // ── Page state: 'landing' | 'app' ──
  const [page, setPage] = useState('landing');

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vm-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  if (page === 'app') {
    return (
      <VirtualMouseApp
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onGoHome={() => setPage('landing')}
      />
    );
  }

  return (
    <>
      {/* ── Theme toggle on landing page ── */}
      <button
        onClick={handleToggleTheme}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 1000,
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <LandingPage onGetStarted={() => setPage('app')} />
    </>
  );
}
