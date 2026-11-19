"use client";

import { useSession } from "next-auth/react";
import type { AppSlug, PermissionKey } from "@/lib/permissions";

export function usePermission(appSlug: AppSlug, permission: PermissionKey): boolean {
  const { data: session } = useSession();
  if (!session?.user) return false;

  const user = session.user as any;

<<<<<<< HEAD
=======
  // System admin always has full access
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  if (user.isSystem) return true;

  const perms: any[] = user.permissions ?? [];
  const appPerm = perms.find((p) => p.appSlug === appSlug);
  return appPerm?.[permission] ?? false;
}

export function useAppPermissions(appSlug: AppSlug) {
  const { data: session } = useSession();
  if (!session?.user) {
    return { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false };
  }

  const user = session.user as any;
  if (user.isSystem) {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true };
  }

  const perms: any[] = user.permissions ?? [];
  const appPerm = perms.find((p) => p.appSlug === appSlug);
  return {
    canView: appPerm?.canView ?? false,
    canCreate: appPerm?.canCreate ?? false,
    canEdit: appPerm?.canEdit ?? false,
    canDelete: appPerm?.canDelete ?? false,
    canApprove: appPerm?.canApprove ?? false,
  };
}
