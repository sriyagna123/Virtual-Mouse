/**
 * useSystemMouse.js
 * ─────────────────────────────────────────────────────────────────────
 * Connects to python mouse_server.py via WebSocket and sends
 * OS-level cursor commands. Auto-reconnects every 2s.
 *
 * Supported messages: move, left_click, right_click, double_click,
 *                     drag_start, drag_end, scroll (direction + amount)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:8765';
const MOVE_THROTTLE_MS = 14;   // ~70 fps max to server

export function useSystemMouse() {
  const wsRef          = useRef(null);
  const lastMoveSentRef = useRef(0);
  const reconnTimerRef  = useRef(null);
  const unmountedRef    = useRef(false);

  const [connected,  setConnected]  = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [error,      setError]      = useState(null);

  // ── Send helper ──────────────────────────────────────────────────────────
  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // ── Connect / auto-reconnect ─────────────────────────────────────────────
  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    const ws = wsRef.current;
    if (ws && ws.readyState <= WebSocket.OPEN) return;

    try {
      const sock = new WebSocket(WS_URL);

      sock.onopen = () => {
        if (unmountedRef.current) { sock.close(); return; }
        setConnected(true);
        setError(null);
        clearTimeout(reconnTimerRef.current);
      };

      sock.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'connected')
            setServerInfo({ screenW: msg.screen_w, screenH: msg.screen_h });
        } catch { /* ignore */ }
      };

      sock.onerror = () => {
        setError('Python server not running. Start: python server/mouse_server.py');
      };

      sock.onclose = () => {
        if (unmountedRef.current) return;
        setConnected(false);
        reconnTimerRef.current = setTimeout(connect, 2000);
      };

      wsRef.current = sock;
    } catch (err) {
      setError(`WebSocket: ${err.message}`);
      reconnTimerRef.current = setTimeout(connect, 2000);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // ── Public API ───────────────────────────────────────────────────────────
  const sendMove = useCallback((normX, normY) => {
    const now = performance.now();
    if (now - lastMoveSentRef.current < MOVE_THROTTLE_MS) return;
    lastMoveSentRef.current = now;
    send({ type: 'move', x: normX, y: normY });
  }, [send]);

  const sendLeftClick  = useCallback(() => send({ type: 'left_click'  }), [send]);
  const sendRightClick = useCallback(() => send({ type: 'right_click' }), [send]);
  const sendDblClick   = useCallback(() => send({ type: 'double_click'}), [send]);
  const sendDragStart  = useCallback(() => send({ type: 'drag_start'  }), [send]);
  const sendDragEnd    = useCallback(() => send({ type: 'drag_end'    }), [send]);

  const sendScroll = useCallback((direction = 'up', amount = 3) => {
    send({ type: 'scroll', direction, amount });
  }, [send]);

  return {
    connected, serverInfo, error,
    sendMove, sendLeftClick, sendRightClick,
    sendDblClick, sendDragStart, sendDragEnd, sendScroll,
  };
}
