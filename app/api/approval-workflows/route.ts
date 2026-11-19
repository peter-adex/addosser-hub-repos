import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { MODULE_OPTIONS, MODULE_ACTIONS } from "@/lib/approval-workflow-modules";

export const dynamic = "force-dynamic";

const MODULE_KEYS = MODULE_OPTIONS.map((m) => m.value) as [string, ...string[]];

const WorkflowSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  module: z.enum(MODULE_KEYS),
  action: z.string().min(1, "Action is required"),
  description: z.string().optional(),
  isExceptional: z.boolean().optional().default(false),
  entityId: z.string().optional(),
  steps: z
    .array(
      z.object({
        stepNumber: z.number().int().min(1),
        userId: z.string().optional(),
        roleId: z.string().optional(),
        label: z.string().optional(),
        approvalLimitAmount: z.number().optional(),
        isExceptionalApprover: z.boolean().optional().default(false),
      })
      .refine((s) => !!s.userId || !!s.roleId, {
        message: "Each step requires either an approver (user) or a role",
      }),
    )
    .min(1, "At least one approval step is required"),
}).refine(
  (data) => (MODULE_ACTIONS[data.module] ?? []).some((a) => a.value === data.action),
  (data) => ({
    message: `"${data.action}" is not a valid action for the "${data.module}" module`,
    path: ["action"],
  }),
);

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workflows = await prisma.approvalWorkflow.findMany({
    include: {
      entity: { select: { name: true, code: true } },
      steps: {
        include: {
          role: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { stepNumber: "asc" },
      },
      _count: { select: { instances: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: workflows });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (!text?.trim())
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 },
      );
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = WorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { name, module, action, description, isExceptional, entityId, steps } =
    parsed.data;

  const existing = await prisma.approvalWorkflow.findFirst({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: `A workflow named "${name}" already exists` },
      { status: 409 },
    );
  }

  if (entityId) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 400 });
    }
  }

  const userIds = steps.map((s) => s.userId).filter(Boolean) as string[];
  const roleIds = steps.map((s) => s.roleId).filter(Boolean) as string[];

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

  const userNameMap = Object.fromEntries(validUsers.map((u) => [u.id, u.name]));
  const roleNameMap = Object.fromEntries(validRoles.map((r) => [r.id, r.name]));

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      name,
      module,
      action,
      description,
      isExceptional,
      entityId: entityId ?? null,
      steps: {
        create: steps.map((s) => ({
          stepNumber: s.stepNumber,
          userId: s.userId ?? null,
          roleId: s.roleId ?? null,
          roleName: s.roleId ? (roleNameMap[s.roleId] ?? "") : "",
          label: s.label ?? (s.userId ? userNameMap[s.userId] : undefined),
          approvalLimitAmount: module === "invoice" ? s.approvalLimitAmount : undefined,
          isExceptionalApprover: module === "invoice" ? !!s.isExceptionalApprover : false,
        })),
      },
    },
    include: {
      entity: { select: { name: true, code: true } },
      steps: {
        include: {
          role: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { stepNumber: "asc" },
      },
    },
  });

  await logAudit({
    userId: user.id,
    action: "WORKFLOW_CREATED",
    module: "admin",
    resourceType: "ApprovalWorkflow",
    resourceId: workflow.id,
    afterData: JSON.stringify({
      name,
      module,
      action,
      stepCount: steps.length,
    }),
  });

  return NextResponse.json({ success: true, data: workflow }, { status: 201 });
}
