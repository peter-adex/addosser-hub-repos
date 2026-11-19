"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IDLE_TIMEOUT_MS, isSafeReturnPath } from "@/lib/session-config";

const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

export default function IdleSessionTracker() {
  const { status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerUpdateRef = useRef<number>(Date.now());

  const currentPath = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const handleIdleTimeout = useCallback(async () => {
    try {
      await signOut({ redirect: false });
    } catch {
    }
    const params = new URLSearchParams({ reason: "idle" });
    if (isSafeReturnPath(currentPathRef.current)) {
      params.set("callbackUrl", currentPathRef.current);
    }
    router.push(`/login?${params.toString()}`);
  }, [router]);

  const scheduleIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
  }, [handleIdleTimeout]);

  const handleActivity = useCallback(() => {
    scheduleIdleTimer();
    const now = Date.now();
    if (now - lastServerUpdateRef.current >= ACTIVITY_UPDATE_THROTTLE_MS) {
      lastServerUpdateRef.current = now;
      update().catch(() => {
      });
    }
  }, [scheduleIdleTimer, update]);

  useEffect(() => {
    if (status !== "authenticated") return;

    scheduleIdleTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [status, scheduleIdleTimer, handleActivity]);

  return null;
}
