"use client";

import { useSession } from "next-auth/react";

export function usePaymentCaps() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const none = { assign: false, process: false, approve: false, canView: (_page?: string) => false };
  if (!user) return none;

  if (user.isSystem) {
    return { assign: true, process: true, approve: true, canView: (_page?: string) => true };
  }

  const caps = user.paymentCaps as
    | { assign: boolean; process: boolean; approve: boolean; viewPages: string[] }
    | undefined;
  if (!caps) {
    const flat = (user.permissions ?? []).find((p: any) => p.appSlug === "payment");
    return {
      assign: !!flat?.canCreate,
      process: !!flat?.canEdit,
      approve: !!flat?.canApprove,
      canView: (_page?: string) => !!flat?.canView,
    };
  }

  const all = caps.viewPages.includes("*");
  return {
    assign: caps.assign,
    process: caps.process,
    approve: caps.approve,
    canView: (page?: string) => (all ? true : page ? caps.viewPages.includes(page) : caps.viewPages.length > 0),
  };
}
