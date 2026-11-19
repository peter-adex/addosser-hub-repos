import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function adminOnly(user: any) {
  return user?.isSystem || user?.roleName === "Super Admin";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wf = await prisma.approvalWorkflow.findUnique({
    where: { id: params.id },
    include: {
      steps: {
        include: { role: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { stepNumber: "asc" },
      },
      _count: { select: { instances: true } },
    },
  });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: wf });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!adminOnly(session.user as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const { name, entityId, description, isActive, module, action, steps, isExceptional } =
    body;

  if (name) {
    const existing = await prisma.approvalWorkflow.findFirst({
      where: {
        name,
        NOT: {
          id: params.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `A workflow named "${name}" already exists`,
        },
        { status: 409 },
      );
    }
  }

  let userNameMap: Record<string, string> = {};
  let roleNameMap: Record<string, string> = {};
  if (steps && Array.isArray(steps)) {
    const userIds = steps.map((s: any) => s.userId).filter(Boolean);
    const roleIds = steps.map((s: any) => s.roleId).filter(Boolean);

    const [validUsers, validRoles] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      roleIds.length
        ? prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    if (validUsers.length !== new Set(userIds).size) {
      return NextResponse.json({ error: "One or more approver (user) IDs are invalid" }, { status: 400 });
    }
    if (validRoles.length !== new Set(roleIds).size) {
      return NextResponse.json({ error: "One or more role IDs are invalid" }, { status: 400 });
    }

    userNameMap = Object.fromEntries(validUsers.map((u) => [u.id, u.name]));
    roleNameMap = Object.fromEntries(validRoles.map((r) => [r.id, r.name]));
  }

  if (entityId) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 400 });
    }
  }

  const effectiveModule = module ?? (await prisma.approvalWorkflow.findUnique({ where: { id: params.id }, select: { module: true } }))?.module;

  const updated = await prisma.$transaction(async (tx) => {
    if (steps) {
      await tx.approvalWorkflowStep.deleteMany({
        where: {
          workflowId: params.id,
        },
      });
    }

    return tx.approvalWorkflow.update({
      where: {
        id: params.id,
      },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(entityId !== undefined ? { entityId: entityId ?? null } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(module !== undefined ? { module } : {}),
        ...(action !== undefined ? { action } : {}),
        ...(isExceptional !== undefined ? { isExceptional } : {}),
        ...(steps
          ? {
              steps: {
                create: steps.map((s: any, i: number) => ({
                  stepNumber: s.stepNumber ?? i + 1,
                  userId: s.userId ?? null,
                  roleId: s.roleId ?? null,
                  roleName: s.roleId ? (roleNameMap[s.roleId] ?? "") : "",
                  label: s.label ?? (s.userId ? userNameMap[s.userId] : undefined),
                  approvalLimitAmount:
                    effectiveModule === "invoice" && s.approvalLimitAmount
                      ? Number(s.approvalLimitAmount)
                      : null,
                  isExceptionalApprover:
                    effectiveModule === "invoice" ? !!s.isExceptionalApprover : false,
                })),
              },
            }
          : {}),
      },
      include: {
        steps: {
          include: {
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: {
            stepNumber: "asc",
          },
        },
      },
    });
  });

  await logAudit({
    userId: (session.user as any).id,
    action: "WORKFLOW_UPDATED",
    module: "admin",
    resourceId: params.id,
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminOnly(session.user as any))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const active = await prisma.approvalInstance.count({
    where: { workflowId: params.id, status: "IN_PROGRESS" },
  });
  if (active > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${active} active approval(s) in progress` },
      { status: 409 },
    );
  }

  await prisma.approvalWorkflow.delete({ where: { id: params.id } });
  await logAudit({
    userId: (session.user as any).id,
    action: "WORKFLOW_DELETED",
    module: "admin",
    resourceId: params.id,
  });

  return NextResponse.json({ success: true });
}
