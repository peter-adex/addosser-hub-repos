import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
<<<<<<< HEAD
import { notifyBudgetApprovers } from "@/lib/budget-notifications";
import { distributeAnnualBudget } from "@/lib/budget";
import { hasGranularPermission } from "@/lib/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

=======
import { distributeAnnualBudget } from "@/lib/budget";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
const CreateBudgetSchema = z.object({
  entityId: z.string().cuid(),
  glAccountId: z.string().cuid(),
  financialYear: z.number().int().min(2020).max(2030),
  annualAmount: z.number().positive(),
  distributionType: z.enum(["EQUAL", "WEIGHTED", "MANUAL"]),
<<<<<<< HEAD
  budgetType: z.enum(["OPEX", "CAPEX"]).default("OPEX"),
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  notes: z.string().optional(),
  monthlyAmounts: z.array(z.number()).length(12).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasGranularPermission("budgeting", "budgets", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const budgetType = searchParams.get("budgetType");

  const glAccountId = searchParams.get("glAccountId");
  const glAccountCode =
    searchParams.get("glAccountCode") || searchParams.get("glCode");

  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!)
    : new Date().getFullYear();

  const entityGLFilter: any = {};
  if (entityId) {
    entityGLFilter.entityId = entityId;
  }

  if (glAccountId) {
    entityGLFilter.glAccountId = glAccountId;
  } else if (glAccountCode) {
    entityGLFilter.glAccount = {
      code: glAccountCode,
    };
  }

  try {
    if (glAccountId || glAccountCode) {
      const budgetRecord = await prisma.budget.findFirst({
        where: {
          financialYear: year,
          status: {
            in: ["APPROVED", "ACTIVE"],
          },
          entityGL: entityGLFilter,
          ...(budgetType && budgetType !== "ALL"
            ? { budgetType: budgetType as "OPEX" | "CAPEX" }
            : {}),
        },
        include: {
          monthlyLines: true,
          actualLines: true,
          entityGL: { include: { glAccount: true, entity: true } },
        },
      });

      return NextResponse.json({ success: true, data: budgetRecord });
    }

    const budgets = await prisma.budget.findMany({
      where: {
        financialYear: year,
        ...(entityId ? { entityGL: { entityId } } : {}),
        ...(budgetType && budgetType !== "ALL"
          ? { budgetType: budgetType as "OPEX" | "CAPEX" }
          : {}),
      },
      include: {
        monthlyLines: true,
        actualLines: true,
        entityGL: { include: { glAccount: true, entity: true } },
      },
      orderBy: { entityGL: { glAccount: { code: "asc" } } },
    });

    return NextResponse.json({ success: true, data: budgets });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasGranularPermission("budgeting", "budgets", "create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasPermission("budgeting", "canView");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();

  const budgets = await prisma.budget.findMany({
    where: {
      financialYear: year,
      ...(entityId ? { entityGL: { entityId } } : {}),
    },
    include: {
      monthlyLines: true,
      actualLines: true,
      entityGL: { include: { glAccount: true, entity: true } },
    },
    orderBy: { entityGL: { glAccount: { code: "asc" } } },
  });

  return NextResponse.json({ success: true, data: budgets });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = await hasPermission("budgeting", "canCreate");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const body = await req.json();
  const parsed = CreateBudgetSchema.safeParse(body);
  if (!parsed.success) {
<<<<<<< HEAD
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const {
    entityId,
    glAccountId,
    financialYear,
    annualAmount,
    distributionType,
    budgetType,
    notes,
    monthlyAmounts,
  } = parsed.data;

=======
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const { entityId, glAccountId, financialYear, annualAmount, distributionType, notes, monthlyAmounts } = parsed.data;

  // Find or create EntityGLAccount
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  let entityGL = await prisma.entityGLAccount.findUnique({
    where: { entityId_glAccountId: { entityId, glAccountId } },
  });

  if (!entityGL) {
<<<<<<< HEAD
    entityGL = await prisma.entityGLAccount.create({
      data: { entityId, glAccountId },
    });
  }

  const existing = await prisma.budget.findFirst({
    where: { entityGLId: entityGL.id, financialYear, budgetType },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: `A ${budgetType} budget already exists for this GL account in ${financialYear}`,
      },
      { status: 409 },
    );
  }

  const amounts =
    distributionType === "MANUAL" && monthlyAmounts
      ? monthlyAmounts
      : distributeAnnualBudget(annualAmount, distributionType);
=======
    entityGL = await prisma.entityGLAccount.create({ data: { entityId, glAccountId } });
  }

  // Check for duplicate
  const existing = await prisma.budget.findUnique({
    where: { entityGLId_financialYear: { entityGLId: entityGL.id, financialYear } },
  });
  if (existing) {
    return NextResponse.json({ error: "A budget already exists for this GL account and year" }, { status: 409 });
  }

  // Calculate monthly amounts
  const amounts = distributionType === "MANUAL" && monthlyAmounts
    ? monthlyAmounts
    : distributeAnnualBudget(annualAmount, distributionType);
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const budget = await prisma.budget.create({
    data: {
      entityGLId: entityGL.id,
      financialYear,
      annualAmount,
      distributionType,
<<<<<<< HEAD
      budgetType,
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      notes,
      status: "DRAFT",
      createdById: (session.user as any).id,
      monthlyLines: {
        create: amounts.map((amount, i) => ({ month: i + 1, amount })),
      },
    },
  });

  await logAudit({
    userId: (session.user as any).id,
    action: "BUDGET_CREATED",
    module: "budgeting",
    entityId,
    resourceId: budget.id,
<<<<<<< HEAD
    meta: { glAccountId, financialYear, annualAmount, budgetType },
  });

  try {
    await notifyBudgetApprovers({
      budgetId: budget.id,
      submitterId: (session.user as any).id,
      entityId,
      glAccountId: entityGL.id,
      financialYear,
      annualAmount,
      distributionType,
      budgetType: parsed.data.budgetType ?? "OPEX",
      notes: parsed.data.notes,
    });
  } catch (notifyErr) {
    console.error("[BudgetPOST] Notification error (non-fatal):", notifyErr);
  }

=======
    meta: { glAccountId, financialYear, annualAmount },
  });

>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  return NextResponse.json({ success: true, data: budget }, { status: 201 });
}
