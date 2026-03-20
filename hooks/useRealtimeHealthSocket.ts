"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RealtimeInitPayload {
  userId: string;
  chatId: string;
  name: string;
  conditionType: string;
  healthData: Record<string, unknown>;
  history: Array<Record<string, unknown>>;
  extraContext?: string;
}

type ConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "closed" | "error";

interface ServerEvent {
  type: string;
  [key: string]: unknown;
}

interface UseRealtimeHealthSocketOptions {
  wsUrl?: string;
  initPayload: RealtimeInitPayload | null;
  autoReconnect?: boolean;
  onAssistantDelta?: (delta: string) => void;
  onAssistantTurnComplete?: () => void;
  onAssistantAudio?: (audioBase64: string) => void;
  onErrorEvent?: (message: string) => void;
}

interface UseRealtimeHealthSocketResult {
  connectionState: ConnectionState;
  isInitialized: boolean;
  lastError: string | null;
  connect: () => void;
  disconnect: () => void;
  sendAudioChunk: (audioChunk: ArrayBuffer | Int16Array) => boolean;
  sendInterrupt: () => boolean;
  sendClearHistory: () => boolean;
  sendPing: () => boolean;
  getBufferedAmount: () => number;
}

const PING_INTERVAL_MS = 10000;
const MAX_MISSED_PONGS = 12;
const MAX_RECONNECT_DELAY_MS = 30000;

export function useRealtimeHealthSocket({
  wsUrl,
  initPayload,
  autoReconnect = false,
  onAssistantDelta,
  onAssistantTurnComplete,
  onAssistantAudio,
  onErrorEvent,
}: UseRealtimeHealthSocketOptions): UseRealtimeHealthSocketResult {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manuallyClosedRef = useRef(false);
  const wsUrlRef = useRef(wsUrl);
  const initPayloadRef = useRef(initPayload);
  const onAssistantDeltaRef = useRef(onAssistantDelta);
  const onAssistantTurnCompleteRef = useRef(onAssistantTurnComplete);
  const onAssistantAudioRef = useRef(onAssistantAudio);
  const onErrorEventRef = useRef(onErrorEvent);
  const autoReconnectRef = useRef(autoReconnect);
  const connectRef = useRef<() => void>(() => undefined);
  const initSentRef = useRef(false);
  const lastServerActivityAtRef = useRef(0);
  const missedPongsRef = useRef(0);

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    wsUrlRef.current = wsUrl;
    initPayloadRef.current = initPayload;
    onAssistantDeltaRef.current = onAssistantDelta;
    onAssistantTurnCompleteRef.current = onAssistantTurnComplete;
    onAssistantAudioRef.current = onAssistantAudio;
    onErrorEventRef.current = onErrorEvent;
    autoReconnectRef.current = autoReconnect;
  }, [wsUrl, initPayload, onAssistantDelta, onAssistantTurnComplete, onAssistantAudio, onErrorEvent, autoReconnect]);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const sendJson = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendPing = useCallback(() => {
    return sendJson({ type: "ping" });
  }, [sendJson]);

  const sendInit = useCallback(() => {
    if (initSentRef.current || !initPayloadRef.current) {
      return false;
    }

    const sent = sendJson({ type: "init", payload: initPayloadRef.current });
    if (sent) {
      initSentRef.current = true;
    }
    return sent;
  }, [sendJson]);

  const scheduleReconnect = useCallback(() => {
    if (manuallyClosedRef.current || !autoReconnectRef.current || !wsUrlRef.current || !initPayloadRef.current) {
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * (2 ** reconnectAttemptsRef.current), MAX_RECONNECT_DELAY_MS);
    setConnectionState("reconnecting");

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!manuallyClosedRef.current) {
        connectRef.current();
      }
    }, delay);
  }, []);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case "connection_ready": {
        sendInit();
        break;
      }
      case "init_ack": {
        initSentRef.current = true;
        setIsInitialized(true);
        setConnectionState("live");
        break;
      }
      case "assistant_delta": {
        const delta = typeof event.delta === "string" ? event.delta : typeof event.text === "string" ? event.text : "";
        if (delta) {
          onAssistantDeltaRef.current?.(delta);
        }
        break;
      }
      case "assistant_turn_complete": {
        onAssistantTurnCompleteRef.current?.();
        break;
      }
      case "assistant_audio": {
        const audioBase64 =
          typeof event.audioBase64 === "string"
            ? event.audioBase64
            : typeof event.audio_base64 === "string"
              ? event.audio_base64
              : "";
        if (audioBase64) {
          onAssistantAudioRef.current?.(audioBase64);
        }
        break;
      }
      case "error": {
        const message = typeof event.message === "string" ? event.message : "Realtime server error";
        setLastError(message);
        setConnectionState("error");
        onErrorEventRef.current?.(message);
        break;
      }
      case "pong": {
        lastServerActivityAtRef.current = Date.now();
        missedPongsRef.current = 0;
        break;
      }
      default: {
        break;
      }
    }
  }, [sendInit]);

  const connect = useCallback(() => {
    if (!wsUrlRef.current || !initPayloadRef.current) {
      setLastError("Missing websocket URL or init payload.");
      return;
    }

    const existing = socketRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    manuallyClosedRef.current = false;
    clearTimers();
    setIsInitialized(false);
    setLastError(null);
    initSentRef.current = false;
    setConnectionState(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");

    const ws = new WebSocket(wsUrlRef.current);
    ws.binaryType = "arraybuffer";
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionState("connecting");
      lastServerActivityAtRef.current = Date.now();
      missedPongsRef.current = 0;
      sendInit();

      pingIntervalRef.current = setInterval(() => {
        const didSendPing = sendPing();
        if (!didSendPing) {
          return;
        }

        if (Date.now() - lastServerActivityAtRef.current >= PING_INTERVAL_MS) {
          missedPongsRef.current += 1;
        }

        if (missedPongsRef.current >= MAX_MISSED_PONGS) {
          ws.close();
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (messageEvent) => {
      lastServerActivityAtRef.current = Date.now();
      missedPongsRef.current = 0;

      if (typeof messageEvent.data !== "string") {
        return;
      }

      try {
        const parsed = JSON.parse(messageEvent.data as string) as ServerEvent;
        handleServerEvent(parsed);
      } catch {
        setLastError("Received invalid realtime payload from server.");
      }
    };

    ws.onerror = () => {
      setLastError("WebSocket error occurred.");
      setConnectionState("error");
    };

    ws.onclose = () => {
      clearTimers();
      setIsInitialized(false);
      socketRef.current = null;

      if (manuallyClosedRef.current || !autoReconnectRef.current) {
        setConnectionState("closed");
        return;
      }

      scheduleReconnect();
    };
  }, [clearTimers, handleServerEvent, scheduleReconnect, sendInit, sendPing]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    manuallyClosedRef.current = true;
    clearTimers();
    reconnectAttemptsRef.current = 0;
    setIsInitialized(false);
    initSentRef.current = false;

    const ws = socketRef.current;
    if (ws) {
      ws.close();
      socketRef.current = null;
    }

    setConnectionState("closed");
  }, [clearTimers]);

  const sendAudioChunk = useCallback((audioChunk: ArrayBuffer | Int16Array) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (audioChunk instanceof Int16Array) {
      const buffer = audioChunk.buffer.slice(
        audioChunk.byteOffset,
        audioChunk.byteOffset + audioChunk.byteLength,
      );
      ws.send(buffer);
      return true;
    }

    ws.send(audioChunk);
    return true;
  }, []);

  const sendInterrupt = useCallback(() => {
    return sendJson({ type: "interrupt" });
  }, [sendJson]);

  const sendClearHistory = useCallback(() => {
    return sendJson({ type: "clear_history" });
  }, [sendJson]);

  const getBufferedAmount = useCallback(() => {
    return socketRef.current?.bufferedAmount ?? 0;
  }, []);

  useEffect(() => {
    return () => {
      manuallyClosedRef.current = true;
      clearTimers();
      initSentRef.current = false;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [clearTimers]);

  return {
    connectionState,
    isInitialized,
    lastError,
    connect,
    disconnect,
    sendAudioChunk,
    sendInterrupt,
    sendClearHistory,
    sendPing,
    getBufferedAmount,
  };
}
