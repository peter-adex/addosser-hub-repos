import { prisma } from "./prisma";

<<<<<<< HEAD
=======
/** Distribute annual amount into 12 monthly values */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function distributeAnnualBudget(
  annual: number,
  type: "EQUAL" | "WEIGHTED" | "MANUAL",
  weights?: number[]
): number[] {
  if (type === "EQUAL") {
    const monthly = annual / 12;
    return Array(12)
      .fill(0)
      .map((_, i) => (i < 11 ? Math.floor(monthly) : annual - Math.floor(monthly) * 11));
  }

  if (type === "WEIGHTED" && weights && weights.length === 12) {
    const total = weights.reduce((s, w) => s + w, 0);
    return weights.map((w) => Math.round((annual * w) / total));
  }

<<<<<<< HEAD
  return Array(12).fill(0);
}

=======
  // MANUAL — return zeros for user to fill
  return Array(12).fill(0);
}

/** Compute YTD budget up to a given month (1-indexed) */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function calcYTDBudget(month: number, lines: { month: number; amount: number | string }[]): number {
  return lines
    .filter((l) => l.month <= month)
    .reduce((sum, l) => sum + Number(l.amount), 0);
}

<<<<<<< HEAD
=======
/** Compute YTD actual up to a given month */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function calcYTDActual(month: number, actuals: { month: number; amount: number | string }[]): number {
  return actuals
    .filter((a) => a.month <= month)
    .reduce((sum, a) => sum + Number(a.amount), 0);
}

<<<<<<< HEAD
=======
/** Variance analysis */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function calcVariance(budget: number, actual: number) {
  const amount = budget - actual;
  const percentage = budget > 0 ? (amount / budget) * 100 : 0;
  const status: "OVER" | "NEAR" | "UNDER" =
    actual > budget ? "OVER" : actual > budget * 0.9 ? "NEAR" : "UNDER";
  return { amount, percentage, status };
}

<<<<<<< HEAD
=======
/** Fetch GL budgets for a given entity, GL codes, year, and optional month filter */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function getEntityGLBudgets(
  entityId: string,
  glCodes: string[],
  year: number,
  month?: number
) {
  return prisma.budget.findMany({
    where: {
      financialYear: year,
      entityGL: {
        entityId,
        glAccount: { code: { in: glCodes } },
      },
    },
    include: {
      monthlyLines: month ? { where: { month } } : true,
      actualLines: month ? { where: { month } } : true,
      entityGL: { include: { glAccount: true } },
    },
  });
}

<<<<<<< HEAD
=======
/** Format number as Nigerian Naira */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function fmtNGN(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

<<<<<<< HEAD
=======
/** Format large numbers compactly */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function fmtCompact(value: number): string {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`;
  return fmtNGN(value);
}

<<<<<<< HEAD
=======
/** Current financial year */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function currentFY(): number {
  return new Date().getFullYear();
}

<<<<<<< HEAD
=======
/** Current month (1–12) */
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export function currentMonth(): number {
  return new Date().getMonth() + 1;
}
