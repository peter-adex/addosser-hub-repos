"use client";

import { useSession, signOut } from "next-auth/react";

export interface FleetPermissionRow {
  appSlug: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

interface FleetNavPage {
  key: string;
  actions: string[];
}
interface FleetNav {
  pages: FleetNavPage[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  customRoleName?: string;
  entityId?: string;
  approvalLimitNgn?: number;
  mustChangePassword: boolean;
  avatarUrl?: string;
  isDriver: boolean;
  driverId?: string | null;
  permissions: FleetPermissionRow[];
}

export type PermissionAction =
  | "canView"
  | "canCreate"
  | "canEdit"
  | "canDelete"
  | "canExport"
  | "canApprove";

export function useAuth(): {
  user: AuthUser | null;
  isLoading: boolean;
  clearAuth: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (module: string, action: PermissionAction) => boolean;
  getModulePerms: (module: string) => Record<string, boolean | string> | null;
} {
  const { data: session, status } = useSession();
  const raw = session?.user as any;

  const user: AuthUser | null = raw
    ? {
        id: raw.id,
        name: raw.name ?? "",
        email: raw.email ?? "",
        role: raw.isSystem ? "admin" : "custom_user",
        customRoleName: raw.roleName,
        entityId: raw.entityId,
        approvalLimitNgn: raw.approvalLimit != null ? Number(raw.approvalLimit) : undefined,
        mustChangePassword: !!raw.mustChangePassword,
        avatarUrl: raw.image ?? undefined,
        isDriver: !!raw.isDriver,
        driverId: raw.driverId ?? null,
        permissions: (raw.permissions ?? []) as FleetPermissionRow[],
      }
    : null;

  const isAdmin = user?.role === "admin";

  function getFleetGranularActions(pageKey: string): Set<string> {
    const nav = raw?.fleetNav as FleetNav | null | undefined;
    const page = nav?.pages?.find((p) => p.key === pageKey);
    return new Set(page?.actions ?? []);
  }

  function hasPermission(_module: string, action: PermissionAction): boolean {
    if (!user) return false;
    if (isAdmin) return true;

    const granularKey = action.replace(/^can/, "").toLowerCase();
    const granted = getFleetGranularActions(_module);
    if (granted.has(granularKey)) return true;
    if (action === "canExport" && granted.has("view")) return true;

    return false;
  }

  function getModulePerms(_module: string): Record<string, boolean | string> | null {
    if (!user) return null;
    if (isAdmin) {
      return { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canApprove: true };
    }
    const granted = getFleetGranularActions(_module);
    if (granted.size === 0) return null;
    return {
      canView: granted.has("view"),
      canCreate: granted.has("create"),
      canEdit: granted.has("edit"),
      canDelete: granted.has("delete"),
      canExport: granted.has("export") || granted.has("view"),
      canApprove: granted.has("approve"),
    };
  }

  return {
    user,
    isLoading: status === "loading",
    clearAuth: () => signOut({ callbackUrl: "/login" }),
    isAdmin,
    hasPermission,
    getModulePerms,
  };
}
