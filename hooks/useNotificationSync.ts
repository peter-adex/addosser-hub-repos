"use client";
import { useEffect, useState } from "react";

export function useNotificationSync(initialCount: number = 0) {
  const [unreadCount, setUnreadCount] = useState(initialCount);

  useEffect(() => {
    const handleSyncEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (
        customEvent.detail &&
        typeof customEvent.detail.unreadCount === "number"
      ) {
        setUnreadCount(customEvent.detail.unreadCount);
      }
    };

    window.addEventListener("sync-notifications", handleSyncEvent);

    return () => {
      window.removeEventListener("sync-notifications", handleSyncEvent);
    };
  }, []);

  return {
    unreadCount,
    setUnreadCount,
  };
}
