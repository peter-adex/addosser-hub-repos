"use client";

import { useSession } from "next-auth/react";
import type { SessionUser } from "@/types";

export function useCurrentUser(): SessionUser | null {
  const { data: session } = useSession();
  return session?.user ? (session.user as unknown as SessionUser) : null;
}
