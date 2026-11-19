import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const module = searchParams.get("module") ?? "invoice";
  const isBudgetExceeded = searchParams.get("isBudgetExceeded") === "true";

  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }

  const workflows = await prisma.approvalWorkflow.findMany({
    where: { entityId, module, isActive: true },
    include: {
      steps: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { stepNumber: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (workflows.length === 0) {
    return NextResponse.json({
      success: true,
      workflowId: null,
      steps: [],
      message: `No active Approval Workflow is configured for this entity/module. Ask an Administrator to configure one in Admin → Approvals before invoices can be submitted.`,
    });
  }

  const workflowId = workflows[0].id;
  const workflowName =
    workflows.length > 1
      ? `${workflows.map((w) => w.name).join(" + ")}`
      : workflows[0].name;
  const allSteps = workflows.flatMap((w) => w.steps);

  const byStep = new Map<number, typeof allSteps>();
  for (const step of allSteps) {
    if (!step.userId || !step.user) continue;
    if (isBudgetExceeded && !step.isExceptionalApprover) continue;
    const list = byStep.get(step.stepNumber) ?? [];
    list.push(step);
    byStep.set(step.stepNumber, list);
  }

  const steps = Array.from(byStep.entries())
    .sort(([a], [b]) => a - b)
    .map(([stepNumber, rows]) => ({
      stepNumber,
      label: rows[0].label || `Step ${stepNumber}`,
      approvers: rows.map((r) => ({
        userId: r.user!.id,
        name: r.user!.name,
        email: r.user!.email,
        approvalLimitAmount: r.approvalLimitAmount ? Number(r.approvalLimitAmount) : null,
        isExceptionalApprover: r.isExceptionalApprover,
      })),
    }));

  const missingStep = steps.find((s) => s.approvers.length === 0);

  return NextResponse.json({
    success: true,
    workflowId,
    workflowName,
    steps,
    ...(isBudgetExceeded && steps.length === 0
      ? {
          message:
            "This invoice exceeds the available GL budget, but no approver in this workflow is configured with Exceptional Approval Workflow permission. Ask an Administrator to configure one before this invoice can be submitted.",
        }
      : {}),
    ...(missingStep
      ? { message: `Step ${missingStep.stepNumber} ("${missingStep.label}") has no eligible approvers configured.` }
      : {}),
  });
}
