/**
 * useVirtualMouse.js
 * Manages virtual cursor state: position, click simulation overlay,
 * and scroll events. Since browsers restrict direct OS-level mouse
 * control from web pages, this hook simulates cursor movement over
 * a full-screen overlay and fires synthetic DOM events.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export function useVirtualMouse() {
  const [cursorPos, setCursorPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [isLeftClicking, setIsLeftClicking] = useState(false);
  const [isRightClicking, setIsRightClicking] = useState(false);
  const [clickLog, setClickLog] = useState([]);

  // Smooth interpolation state
  const targetPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const currentPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const animFrameRef = useRef(null);
  const SMOOTHING = 0.15; // lerp factor (0=no movement, 1=instant)

  /**
   * Smoothly interpolates cursor position for a natural feel.
   */
  useEffect(() => {
    const animate = () => {
      const tx = targetPos.current.x;
      const ty = targetPos.current.y;
      const cx = currentPos.current.x;
      const cy = currentPos.current.y;

      const nx = cx + (tx - cx) * SMOOTHING;
      const ny = cy + (ty - cy) * SMOOTHING;

      if (Math.abs(nx - cx) > 0.1 || Math.abs(ny - cy) > 0.1) {
        currentPos.current = { x: nx, y: ny };
        setCursorPos({ x: nx, y: ny });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  /**
   * Update target cursor position from hand tracking data.
   * Accepts { normX, normY } — normalised 0-1 values.
   * Maps to pixel positions within the viewport for the overlay cursor.
   */
  const moveCursor = useCallback(({ normX, normY }) => {
    const margin = 20;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const x = margin + normX * (screenW - margin * 2);
    const y = margin + normY * (screenH - margin * 2);

    targetPos.current = {
      x: Math.max(0, Math.min(screenW, x)),
      y: Math.max(0, Math.min(screenH, y)),
    };
  }, []);

  /**
   * Simulate a left click at the current cursor position.
   */
  const performLeftClick = useCallback(() => {
    setIsLeftClicking(true);
    setClickLog((prev) => [
      { type: 'left', x: Math.round(cursorPos.x), y: Math.round(cursorPos.y), time: Date.now() },
      ...prev.slice(0, 9),
    ]);

    // Fire a real click event on the element under the cursor
    const el = document.elementFromPoint(cursorPos.x, cursorPos.y);
    if (el && el.id !== 'virtual-cursor' && el.id !== 'virtual-cursor-overlay') {
      el.click();
    }

    setTimeout(() => setIsLeftClicking(false), 300);
  }, [cursorPos]);

  /**
   * Simulate a right click at the current cursor position.
   */
  const performRightClick = useCallback(() => {
    setIsRightClicking(true);
    setClickLog((prev) => [
      { type: 'right', x: Math.round(cursorPos.x), y: Math.round(cursorPos.y), time: Date.now() },
      ...prev.slice(0, 9),
    ]);

    const el = document.elementFromPoint(cursorPos.x, cursorPos.y);
    if (el && el.id !== 'virtual-cursor') {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: cursorPos.x,
        clientY: cursorPos.y,
      });
      el.dispatchEvent(event);
    }

    setTimeout(() => setIsRightClicking(false), 300);
  }, [cursorPos]);

  /**
   * Simulate scroll up.
   */
  const performScrollUp = useCallback(() => {
    const el = document.elementFromPoint(cursorPos.x, cursorPos.y);
    const target = el || document.body;
    target.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    );
    window.scrollBy({ top: -100, behavior: 'smooth' });
  }, [cursorPos]);

  /**
   * Simulate scroll down.
   */
  const performScrollDown = useCallback(() => {
    const el = document.elementFromPoint(cursorPos.x, cursorPos.y);
    const target = el || document.body;
    target.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    );
    window.scrollBy({ top: 100, behavior: 'smooth' });
  }, [cursorPos]);

  return {
    cursorPos,
    isLeftClicking,
    isRightClicking,
    clickLog,
    moveCursor,
    performLeftClick,
    performRightClick,
    performScrollUp,
    performScrollDown,
  };
}
