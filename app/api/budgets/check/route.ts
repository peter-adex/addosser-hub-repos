import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasGranularPermission } from "@/lib/permissions";
import { checkOpexBudget } from "@/lib/budget-validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasGranularPermission("invoice", "invoices", "create")) && !(await hasGranularPermission("budgeting", "budgets", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const glAccountCode = searchParams.get("glAccountCode") ?? searchParams.get("glAccountId");
  const amount = parseFloat(searchParams.get("amount") ?? "0");

  if (!entityId || !glAccountCode) {
    return NextResponse.json({ error: "entityId and glAccountCode are required" }, { status: 400 });
  }

  const result = await checkOpexBudget({
    entityId,
    glAccountCode,
    amountPayable: isNaN(amount) ? 0 : amount,
  });

  return NextResponse.json({
    success: true,
    data: {
      found: result.hasBudget,
      available: Math.max(0, result.monthlyAvailable),
      annualBudget: result.annualBudget,
      monthlyBudget: result.monthlyBudget,
      monthlyCommitted: result.monthlyCommitted,
      monthlyAvailable: result.monthlyAvailable,
      exceeded: result.exceeded,
      exceedBy: result.exceedanceAmount,
      financialYear: result.financialYear,
      currentMonth: result.currentMonth,
      message: result.hasBudget
        ? undefined
        : "No approved OPEX budget found for this GL account in the current year.",
    },
  });
}
