import { prisma } from "@/lib/prisma";
import { getGrantedActionsForModuleByRole } from "@/lib/rbac";
import { getRoleIdsWithPageAction } from "@/lib/rbac-roles";

let treeReady = false;
let warned = false;

async function paymentTreeReady(): Promise<boolean> {
  if (treeReady) return true;
  const page = await prisma.permPage.findFirst({
    where: { key: "workflow", isActive: true, module: { key: "payment", isActive: true } },
    select: { id: true },
  });
  if (page) {
    treeReady = true;
    return true;
  }
  if (!warned) {
    warned = true;
    console.warn(
      "[payment-access] Payment Workflow Roles permissions not found in the database — " +
        "falling back to the legacy flat flags. Run `npm run db:seed:rbac` to finish the migration.",
    );
  }
  return false;
}

export interface PaymentCaps {
  assign: boolean;
  process: boolean;
  approve: boolean;
  view: (pageKey?: string) => boolean;
  viewPages: string[];
}

interface CapsUser {
  roleId?: string | null;
  isSystem?: boolean;
  permissions?: any[];
}

export async function getPaymentCaps(user: CapsUser): Promise<PaymentCaps> {
  if (user.isSystem) {
    return { assign: true, process: true, approve: true, view: () => true, viewPages: ["*"] };
  }

  if (!(await paymentTreeReady())) {
    const flat = (user.permissions ?? []).find((p: any) => p.appSlug === "payment");
    return {
      assign: !!flat?.canCreate,
      process: !!flat?.canEdit,
      approve: !!flat?.canApprove,
      view: () => !!flat?.canView,
      viewPages: flat?.canView ? ["*"] : [],
    };
  }

  const grants = await getGrantedActionsForModuleByRole("payment", {
    id: user.roleId ?? null,
    isSystem: false,
  });
  return {
    assign: !!grants.get("workflow")?.has("assign"),
    process: !!grants.get("workflow")?.has("process"),
    approve: !!grants.get("approvals")?.has("approve"),
    view: (pageKey) => {
      if (pageKey) return !!grants.get(pageKey)?.has("view");
      for (const actions of grants.values()) if (actions.has("view")) return true;
      return false;
    },
    viewPages: Array.from(grants.entries())
      .filter(([, actions]) => actions.has("view"))
      .map(([page]) => page),
  };
}

export async function getPaymentCapsForRole(roleId: string, isSystem: boolean): Promise<PaymentCaps> {
  if (isSystem || (await paymentTreeReady())) return getPaymentCaps({ roleId, isSystem });
  const flat = await prisma.rolePermission.findFirst({
    where: { roleId, app: { slug: "payment" } },
    select: { canView: true, canCreate: true, canEdit: true, canApprove: true },
  });
  return getPaymentCaps({ roleId, isSystem, permissions: flat ? [{ appSlug: "payment", ...flat }] : [] });
}

async function flatRoleIds(where: Record<string, boolean>): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { app: { slug: "payment" }, ...where },
    select: { roleId: true },
  });
  return rows.map((r) => r.roleId);
}

export async function getTellerRoleIds(): Promise<string[]> {
  return (await paymentTreeReady())
    ? getRoleIdsWithPageAction("payment", "workflow", "process")
    : flatRoleIds({ canEdit: true });
}

export async function getHeadRoleIds(): Promise<string[]> {
  return (await paymentTreeReady())
    ? getRoleIdsWithPageAction("payment", "workflow", "assign")
    : flatRoleIds({ canCreate: true });
}

export async function getSupervisorRoleIds(): Promise<string[]> {
  return (await paymentTreeReady())
    ? getRoleIdsWithPageAction("payment", "approvals", "approve")
    : flatRoleIds({ canApprove: true });
}

export async function getHeadOrSupervisorRoleIds(): Promise<string[]> {
  const [heads, supervisors] = await Promise.all([getHeadRoleIds(), getSupervisorRoleIds()]);
  return Array.from(new Set([...heads, ...supervisors]));
}
