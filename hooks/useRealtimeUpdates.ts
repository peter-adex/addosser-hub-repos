"use client";

import { useEffect, useRef, useCallback } from "react";

interface RealtimeCallbacks {
  onNotification?:   (data: Record<string, unknown>) => void;
  onInvoiceUpdate?:  (data: Record<string, unknown>) => void;
  onAssetUpdate?:    (data: Record<string, unknown>) => void;
  onApprovalAction?: (data: Record<string, unknown>) => void;
}

export function useRealtimeUpdates(
  userId:    string | undefined,
  callbacks: RealtimeCallbacks
) {
  const esRef    = useRef<EventSource | null>(null);
  const stableCallbacks = useRef(callbacks);
  stableCallbacks.current = callbacks;

  const connect = useCallback(() => {
    if (!userId) return;

    esRef.current?.close();

    const es = new EventSource(`/api/sse?userId=${userId}`);
    esRef.current = es;

    es.addEventListener("notification",    (e) => {
      try { stableCallbacks.current.onNotification?.(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener("invoice_update",  (e) => {
      try { stableCallbacks.current.onInvoiceUpdate?.(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener("asset_update",    (e) => {
      try { stableCallbacks.current.onAssetUpdate?.(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener("approval_action", (e) => {
      try { stableCallbacks.current.onApprovalAction?.(JSON.parse(e.data)); } catch {}
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setTimeout(connect, 3_000);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    if (typeof EventSource !== "undefined") {
      connect();
    }

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [userId, connect]);
}
