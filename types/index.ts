import type { User, Role, Entity, App, RolePermission, Budget, BudgetLine, ActualLine, GLAccount, EntityGLAccount, Asset, Vehicle, Facility, Invoice } from "@prisma/client";

<<<<<<< HEAD
=======
// ─── Session ────────────────────────────────────────────────────
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  roleId: string;
  roleName: string;
  entityId: string;
  entityName: string;
  entityCode: string;
  isSystem: boolean;
  permissions: AppPermission[];
}

export interface AppPermission {
  appSlug: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

<<<<<<< HEAD
=======
// ─── Budget ─────────────────────────────────────────────────────
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export type BudgetWithRelations = Budget & {
  entityGL: EntityGLAccount & {
    glAccount: GLAccount;
    entity: Entity;
  };
  monthlyLines: BudgetLine[];
  actualLines: ActualLine[];
};

export interface BudgetSummary {
  entityId: string;
  entityName: string;
  entityCode: string;
  glCode: string;
  glName: string;
  category: string;
  annualBudget: number;
  ytdBudget: number;
  ytdActual: number;
  ytdVariance: number;
  utilisation: number;
  status: string;
}

export interface MonthlyBreakdown {
  month: number;
  monthName: string;
  budget: number;
  actual: number;
  balance: number;
  utilisation: number;
}

<<<<<<< HEAD
=======
// ─── User & Role ─────────────────────────────────────────────────
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export type UserWithRelations = User & {
  role: Role;
  entity: Entity;
};

export type RoleWithPermissions = Role & {
  permissions: (RolePermission & { app: App })[];
  _count: { users: number };
};

<<<<<<< HEAD
=======
// ─── API Responses ───────────────────────────────────────────────
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

<<<<<<< HEAD
=======
// ─── Forms ──────────────────────────────────────────────────────
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export interface CreateBudgetForm {
  entityId: string;
  glAccountId: string;
  financialYear: number;
  annualAmount: number;
  distributionType: "EQUAL" | "WEIGHTED" | "MANUAL";
  notes?: string;
  monthlyAmounts?: number[];
}

export interface InviteUserForm {
  email: string;
  name: string;
  roleId: string;
  entityId: string;
}

export interface CreateRoleForm {
  name: string;
  description?: string;
  permissions: {
    appId: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
  }[];
}
