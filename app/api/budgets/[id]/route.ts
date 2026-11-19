import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
<<<<<<< HEAD
import { hasGranularPermission } from "@/lib/permissions";
import { distributeAnnualBudget } from "@/lib/budget";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasGranularPermission("budgeting", "budgets", "view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
=======
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasPermission("budgeting", "canView");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const budget = await prisma.budget.findUnique({
    where: { id: params.id },
    include: {
      monthlyLines: { orderBy: { month: "asc" } },
<<<<<<< HEAD
      actualLines:  { orderBy: { month: "asc" } },
      entityGL:     { include: { glAccount: true, entity: true } },
      createdBy:    { select: { id: true, name: true, email: true } },
      approvals:    { include: { approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
=======
      actualLines: { orderBy: { month: "asc" } },
      entityGL: { include: { glAccount: true, entity: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvals: { include: { approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    },
  });

  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: budget });
}

<<<<<<< HEAD
const UpdateSchema = z.object({
  annualAmount:    z.number().positive().optional(),
  distributionType: z.enum(["EQUAL", "WEIGHTED", "MANUAL"]).optional(),
  budgetType:      z.enum(["OPEX", "CAPEX"]).optional(),
  notes:           z.string().optional(),
  monthlyAmounts:  z.array(z.number()).length(12).optional(),
=======
const UpdateBudgetSchema = z.object({
  annualAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  monthlyAmounts: z.array(z.number()).length(12).optional(),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
<<<<<<< HEAD
  if (!(await hasGranularPermission("budgeting", "budgets", "edit"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body   = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });

  const budget = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  if (budget.status === "APPROVED") return NextResponse.json({ error: "Approved budgets cannot be edited. Please contact an administrator." }, { status: 409 });

  const { annualAmount, distributionType, budgetType, notes, monthlyAmounts } = parsed.data;

  let newMonthlyLines: { month: number; amount: number }[] | undefined;
  const newAnnual = annualAmount ?? Number(budget.annualAmount);
  const newDist   = distributionType ?? budget.distributionType;

  if (annualAmount || distributionType || monthlyAmounts) {
    if (monthlyAmounts && newDist === "MANUAL") {
      newMonthlyLines = monthlyAmounts.map((amount, i) => ({ month: i + 1, amount }));
    } else {
      const amounts   = distributeAnnualBudget(newAnnual, newDist as any);
      newMonthlyLines = amounts.map((amount, i) => ({ month: i + 1, amount }));
    }
  }

  const updated = await prisma.budget.update({
    where: { id: params.id },
    data:  {
      ...(annualAmount    ? { annualAmount }    : {}),
      ...(distributionType ? { distributionType } : {}),
      ...(budgetType      ? { budgetType }      : {}),
      ...(notes !== undefined ? { notes }       : {}),
      ...(budget.status === "REJECTED" ? { status: "DRAFT" } : {}),
      ...(newMonthlyLines
        ? { monthlyLines: { deleteMany: {}, create: newMonthlyLines } }
=======

  const canEdit = await hasPermission("budgeting", "canEdit");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = UpdateBudgetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const budget = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  if (budget.status === "APPROVED") {
    return NextResponse.json({ error: "Approved budgets cannot be edited" }, { status: 409 });
  }

  const { annualAmount, notes, monthlyAmounts } = parsed.data;

  const updated = await prisma.budget.update({
    where: { id: params.id },
    data: {
      ...(annualAmount ? { annualAmount } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(monthlyAmounts
        ? {
            monthlyLines: {
              deleteMany: {},
              create: monthlyAmounts.map((amount, i) => ({ month: i + 1, amount })),
            },
          }
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        : {}),
    },
  });

  await logAudit({
<<<<<<< HEAD
    userId:     (session.user as any).id,
    action:     "BUDGET_UPDATED",
    module:     "budgeting",
    resourceId: params.id,
    meta:       { changes: parsed.data },
=======
    userId: (session.user as any).id,
    action: "BUDGET_UPDATED",
    module: "budgeting",
    resourceId: params.id,
    meta: { changes: parsed.data },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
<<<<<<< HEAD
  if (!(await hasGranularPermission("budgeting", "budgets", "delete"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const budget = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  if (budget.status === "APPROVED") return NextResponse.json({ error: "Approved budgets cannot be deleted" }, { status: 409 });
=======

  const canDelete = await hasPermission("budgeting", "canDelete");
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const budget = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  if (budget.status === "APPROVED") {
    return NextResponse.json({ error: "Approved budgets cannot be deleted" }, { status: 409 });
  }
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  await prisma.budget.delete({ where: { id: params.id } });

  await logAudit({
<<<<<<< HEAD
    userId:     (session.user as any).id,
    action:     "BUDGET_DELETED",
    module:     "budgeting",
=======
    userId: (session.user as any).id,
    action: "BUDGET_DELETED",
    module: "budgeting",
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    resourceId: params.id,
  });

  return NextResponse.json({ success: true });
}
