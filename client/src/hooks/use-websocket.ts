import { useState, useEffect, useRef, useCallback } from "react";
import type { ConsoleLogEntry } from "@shared/schema";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface PriceData {
  value: number;
  method: string;
  sourcesCount: number;
  timestamp: Date;
  cached: boolean;
}

export interface UseWebSocketResult {
  status: ConnectionStatus;
  logs: ConsoleLogEntry[];
  priceData: PriceData | null;
  sendEvent: (event: any) => void;
  subscribe: (requestId: string) => void;
  clearLogs: () => void;
  addLog: (type: ConsoleLogEntry["type"], message: string, eventKind?: number, eventId?: string) => void;
}

export function useWebSocket(): UseWebSocketResult {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((type: ConsoleLogEntry["type"], message: string, eventKind?: number, eventId?: string) => {
    const entry: ConsoleLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
      type,
      message,
      eventKind,
      eventId,
    };
    setLogs((prev) => [...prev.slice(-200), entry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const connect = useCallback(() => {
    const wsUrl = (window as any).RELAY_WS_URL || (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus("connecting");

      ws.addEventListener("open", () => {
        setStatus("connected");
        addLog("success", `Connected to relay`);
      });

      ws.addEventListener("close", () => {
        setStatus("disconnected");
        addLog("info", "Disconnected from relay");

        reconnectTimeoutRef.current = setTimeout(() => {
          addLog("info", "Attempting to reconnect...");
          connect();
        }, 3000);
      });

      ws.addEventListener("error", () => {
        addLog("error", "WebSocket error occurred");
      });

      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (Array.isArray(msg)) {
            if (msg[0] === "EVENT") {
              const evt = msg[1];
              if (evt && (evt.kind === 38001 || evt.kind === 38002)) {
                const content = evt.content;
                try {
                  const parsed = JSON.parse(content);
                  if (evt.kind === 38001) {
                    addLog("event", `Price: $${parsed.value?.toFixed(2)} (${parsed.method}, ${parsed.sources_used?.length || 0} sources)`, evt.kind, evt.id?.slice(0, 8));
                    setPriceData({
                      value: parsed.value,
                      method: parsed.method || "unknown",
                      sourcesCount: parsed.sources_used?.length || 0,
                      timestamp: new Date(),
                      cached: parsed.cache?.hit === true,
                    });
                  } else {
                    addLog("error", `Error: ${parsed.error}`, evt.kind, evt.id?.slice(0, 8));
                  }
                } catch {
                  addLog("event", `Event kind=${evt.kind}`, evt.kind, evt.id?.slice(0, 8));
                }
              }
            } else if (msg[0] === "OK") {
              const [, id, success, message] = msg;
              if (success) {
                addLog("success", `Request accepted: ${id?.slice(0, 8)}...`);
              } else {
                addLog("error", `Request rejected: ${message}`);
              }
            } else if (msg[0] === "NOTICE") {
              addLog("info", `Notice: ${msg[1]}`);
            } else if (msg[0] === "EOSE") {
              addLog("info", `End of stored events for subscription`);
            }
          }
        } catch {
          addLog("info", ev.data);
        }
      });
    } catch (error) {
      addLog("error", `Failed to connect: ${error}`);
      setStatus("disconnected");
    }
  }, [addLog]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendEvent = useCallback((event: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(["EVENT", event]));
    }
  }, []);

  const subscribe = useCallback((requestId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const subId = "sub_" + Math.random().toString(16).slice(2);
      const filter = { kinds: [38001, 38002], "#e": [requestId], limit: 10 };
      wsRef.current.send(JSON.stringify(["REQ", subId, filter]));
    }
  }, []);

  return { status, logs, priceData, sendEvent, subscribe, clearLogs, addLog };
}
