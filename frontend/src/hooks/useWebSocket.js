import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = 'ws://127.0.0.1:8000/ws/agent';
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_MAX_ATTEMPTS = Infinity;

/**
 * Custom WebSocket hook with auto-reconnect and exponential backoff.
 *
 * @param {function} onMessage - callback receiving parsed JSON messages
 * @returns {{ sendMessage, status, reconnect }}
 *   status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
 */
export default function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState('connecting');
  const onMessageRef = useRef(onMessage);

  // Keep callback ref current without re-triggering effect
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {
        // If not JSON, wrap as a plain message
        onMessageRef.current?.({ type: 'message', content: event.data });
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnection
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (attemptRef.current >= RECONNECT_MAX_ATTEMPTS) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, attemptRef.current),
      RECONNECT_MAX_DELAY
    );
    attemptRef.current += 1;

    reconnectTimer.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text);
      return true;
    }
    return false;
  }, []);

  const reconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    attemptRef.current = 0;
    connect();
  }, [connect]);

  return { sendMessage, status, reconnect };
}
