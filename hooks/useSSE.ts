"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface SSENotification {
  id:         string;
  type:       string;
  title:      string;
  message:    string;
  actionUrl?: string;
  isRead:     boolean;
  createdAt:  string;
}

interface UseSSEReturn {
  notifications: SSENotification[];
  unreadCount:   number;
  connected:     boolean;
  markRead:      (id: string) => Promise<void>;
  markAllRead:   () => Promise<void>;
}

export function useSSE(): UseSSEReturn {
  const [notifications, setNotifications] = useState<SSENotification[]>([]);
  const [connected,     setConnected]     = useState(false);
  const retryDelay = useRef(1000);
  const esRef      = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/notifications?unread=true")
      .then((r) => r.json())
      .then((d) => { if (d.success) setNotifications(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      if (typeof window === "undefined") return;

      const es = new EventSource("/api/sse");
      esRef.current = es;

      es.addEventListener("connected", () => {
        setConnected(true);
        retryDelay.current = 1000;
      });

      es.addEventListener("notification", (e) => {
        try {
          const notif: SSENotification = JSON.parse((e as MessageEvent).data);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === notif.id)) return prev;
            return [notif, ...prev];
          });
        } catch { }
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!cancelled) {
          setTimeout(() => {
            retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
            connect();
          }, retryDelay.current);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      setConnected(false);
      esRef.current?.close();
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }) });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch { }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, connected, markRead, markAllRead };
}
