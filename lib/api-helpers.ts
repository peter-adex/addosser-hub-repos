import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { ZodSchema } from "zod";
import { getGrantedActionsForModuleByRole } from "@/lib/rbac";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  customRoleName?: string;
  entityId?: string;
  approvalLimitNgn?: number;
  mustChangePassword: boolean;
  hubPermissions?: {
    appSlug: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
  }[];
  fleetPagePermissions?: Map<string, Set<string>>;
  isSystem?: boolean;
}

export type UserRole = "admin" | "supervisor" | "driver" | "hr_advisor" | "custom_user";

export async function getRequiredSession(): Promise<{ user: SessionUser } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) return null;

  const raw = session.user as any;
  const hubPermissions = (raw.permissions ?? []) as SessionUser["hubPermissions"];

  const fleetPagePermissions = await getGrantedActionsForModuleByRole("fleet", {
    id: raw.roleId ?? null,
    isSystem: !!raw.isSystem,
  });

  const user: SessionUser = {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.isSystem ? "admin" : "custom_user",
    customRoleName: raw.roleName,
    entityId: raw.entityId,
    approvalLimitNgn: raw.approvalLimit != null ? Number(raw.approvalLimit) : undefined,
    mustChangePassword: !!raw.mustChangePassword,
    hubPermissions,
    fleetPagePermissions,
    isSystem: !!raw.isSystem,
  };

  return { user };
}

export function requirePermission(
  session: { user: SessionUser },
  module: string,
  action: "canView" | "canCreate" | "canEdit" | "canDelete" | "canExport" | "canApprove",
): NextResponse | null {
  if (session.user.role === "admin") return null;

  const grants = session.user.fleetPagePermissions;
  if (!grants) {
    return errorResponse("Session expired or permissions not loaded. Please log out and log back in.", 403);
  }

  const ACTION_KEY: Record<typeof action, string> = {
    canView: "view", canCreate: "create", canEdit: "edit",
    canDelete: "delete", canApprove: "approve", canExport: "export",
  };
  const actionKey = ACTION_KEY[action];
  const pageActions = grants.get(module);

  const allowed = action === "canExport"
    ? !!(pageActions?.has("export") || pageActions?.has("view"))
    : !!pageActions?.has(actionKey);

  if (!allowed) {
    const actionLabel = action.replace("can", "").toLowerCase();
    return errorResponse(`Access denied. You don't have permission to ${actionLabel} in this module.`, 403);
  }

  return null;
}

export function requireAdmin(session: { user: SessionUser }): NextResponse | null {
  if (session.user.role === "admin") return null;
  return errorResponse("Access denied. Admin only.", 403);
}

export function requireRole(userRole: string, allowedRoles: string[]): NextResponse | null {
  if (!allowedRoles.includes(userRole)) {
    return errorResponse(`Access denied. Required role: ${allowedRoles.join(" or ")}`, 403);
  }
  return null;
}

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ success: false, error: message, ...(details ? { details } : {}) }, { status });
}

export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      return { data: null, error: errorResponse("Validation failed", 422, messages) };
    }
    return { data: result.data, error: null };
  } catch {
    return { data: null, error: errorResponse("Invalid JSON body", 400) };
  }
}

export function getPagination(request: NextRequest): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginatedResponse<T>(items: T[], total: number, page: number, limit: number): NextResponse {
  return NextResponse.json({
    success: true,
    data: {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
}
