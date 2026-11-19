import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface BudgetCheckResult {
  hasBudget: boolean;
  budgetId?: string;
  entityId: string;
  glAccountCode: string;
  financialYear: number;
  currentMonth: number;

  annualBudget: number;
  monthlyBudget: number;
  monthlyCommitted: number;
  monthlyAvailable: number;

  amountPayable: number;
  exceeded: boolean;
  exceedanceAmount: number;
}

export async function checkOpexBudget(params: {
  entityId: string;
  glAccountCode: string;
  amountPayable: number;
  asOf?: Date;
  tx?: Prisma.TransactionClient;
}): Promise<BudgetCheckResult> {
  const { entityId, glAccountCode, amountPayable } = params;
  const db = params.tx ?? prisma;
  const asOf = params.asOf ?? new Date();
  const financialYear = asOf.getFullYear();
  const currentMonth = asOf.getMonth() + 1;

  const budget = await db.budget.findFirst({
    where: {
      financialYear,
      budgetType: "OPEX",
      status: { in: ["APPROVED", "ACTIVE"] },
      entityGL: { entityId, glAccount: { code: glAccountCode } },
    },
    include: {
      monthlyLines: true,
      actualLines: { where: { month: currentMonth } },
    },
  });

  if (!budget) {
    return {
      hasBudget: false,
      entityId,
      glAccountCode,
      financialYear,
      currentMonth,
      annualBudget: 0,
      monthlyBudget: 0,
      monthlyCommitted: 0,
      monthlyAvailable: 0,
      amountPayable,
      exceeded: false,
      exceedanceAmount: 0,
    };
  }

  const annualBudget = budget.monthlyLines.reduce((s, l) => s + Number(l.amount), 0);
  const monthlyBudget = Number(
    budget.monthlyLines.find((l) => l.month === currentMonth)?.amount ?? 0,
  );
  const monthlyCommitted = budget.actualLines.reduce((s, l) => s + Number(l.amount), 0);
  const monthlyAvailable = parseFloat((monthlyBudget - monthlyCommitted).toFixed(2));

  const exceeded = amountPayable > monthlyAvailable;
  const exceedanceAmount = exceeded
    ? parseFloat((amountPayable - monthlyAvailable).toFixed(2))
    : 0;

  return {
    hasBudget: true,
    budgetId: budget.id,
    entityId,
    glAccountCode,
    financialYear,
    currentMonth,
    annualBudget,
    monthlyBudget,
    monthlyCommitted,
    monthlyAvailable,
    amountPayable,
    exceeded,
    exceedanceAmount,
  };
}

export async function lockBudgetForUpdate(
  tx: Prisma.TransactionClient,
  params: { entityId: string; glAccountCode: string; financialYear: number },
): Promise<{ id: string } | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT b.id
    FROM budgets b
    INNER JOIN entity_gl_accounts ega ON ega.id = b.entityGLId
    INNER JOIN gl_accounts ga ON ga.id = ega.glAccountId
    WHERE ega.entityId = ${params.entityId}
      AND ga.code = ${params.glAccountCode}
      AND b.financialYear = ${params.financialYear}
      AND b.budgetType = 'OPEX'
      AND b.status IN ('APPROVED', 'ACTIVE')
    FOR UPDATE
  `;
  return rows[0] ?? null;
}
