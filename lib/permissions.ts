import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { redirect } from "next/navigation";

<<<<<<< HEAD
export type AppSlug = "budgeting" | "assets" | "facility" | "fleet" | "invoice" | "payment" | "finance";
=======
export type AppSlug = "budgeting" | "assets" | "facility" | "fleet" | "invoice";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export type PermissionKey = "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove";

export interface UserPermission {
  appSlug: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

<<<<<<< HEAD
=======
/** Get full permission object for a given app from the session */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function getAppPermission(appSlug: AppSlug): Promise<UserPermission | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const perms: UserPermission[] = (session.user as any).permissions ?? [];

<<<<<<< HEAD
=======
  // System admin gets all permissions
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  if ((session.user as any).isSystem) {
    return { appSlug, canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true };
  }

  return perms.find((p) => p.appSlug === appSlug) ?? null;
}

<<<<<<< HEAD
=======
/** Check a single permission for a given app */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function hasPermission(appSlug: AppSlug, permission: PermissionKey): Promise<boolean> {
  const perm = await getAppPermission(appSlug);
  return perm?.[permission] ?? false;
}

<<<<<<< HEAD
=======
/** Redirect to /unauthorized if permission is missing */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function requirePermission(appSlug: AppSlug, permission: PermissionKey) {
  const allowed = await hasPermission(appSlug, permission);
  if (!allowed) redirect("/unauthorized");
}

<<<<<<< HEAD
export type GranularAction =
  | "view" | "create" | "edit" | "delete" | "approve" | "export"
  | "import" | "enable" | "disable"
  | "assign" | "process";

export async function hasGranularPermission(
  moduleKey: string,
  pageKey: string,
  action: GranularAction,
): Promise<boolean> {
  const session = await getServerSession(authOptions);
  const raw = session?.user as any;
  if (!raw) return false;

  if (raw.isSystem) return true;

  const { getGrantedActionsForModuleByRole } = await import("./rbac");
  const grants = await getGrantedActionsForModuleByRole(moduleKey, {
    id: raw.roleId ?? null,
    isSystem: !!raw.isSystem,
  });
  const actions = grants.get(pageKey);
  return action === "export"
    ? !!(actions?.has("export") || actions?.has("view"))
    : !!actions?.has(action);
}

export async function requireGranularPermission(
  moduleKey: string,
  pageKey: string,
  action: GranularAction,
) {
  const allowed = await hasGranularPermission(moduleKey, pageKey, action);
  if (!allowed) redirect("/unauthorized");
}

=======
/** Get currently logged-in user from session */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as any;
}

<<<<<<< HEAD
=======
/** Require authentication or redirect to login */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
<<<<<<< HEAD

export async function userHasEntityAccess(entityId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.isSystem) return true;
  if (user.entityId === entityId) return true;

  const { prisma } = await import("./prisma");
  const link = await prisma.userEntity.findFirst({ where: { userId: user.id, entityId } });
  return !!link;
}
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
