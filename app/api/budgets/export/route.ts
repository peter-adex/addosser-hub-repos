import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";
import { MONTHS } from "@/lib/utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ExportSchema = z.object({
  entityIds:    z.array(z.string()).optional(),
  budgetType:   z.enum(["OPEX", "CAPEX", "ALL"]).default("ALL"),
  financialYear: z.number().int().min(2020).max(2030),
  fromMonth:    z.number().int().min(1).max(12).default(1),
  toMonth:      z.number().int().min(1).max(12).default(12),
  fields:       z.array(z.enum([
    "entity", "glCode", "glName", "category", "budgetType",
    "annualBudget", "monthlyBudget", "actualSpend", "balance",
    "utilisation", "status", "financialYear",
  ])).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasGranularPermission("budgeting", "import_export", "view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body   = await req.json();
  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });

  const user = session.user as any;
  const { entityIds, budgetType, financialYear, fromMonth, toMonth, fields } = parsed.data;

  const allowedEntityIds = user.isSystem
    ? entityIds
    : [user.entityId];

  const budgets = await prisma.budget.findMany({
    where: {
      financialYear,
      ...(budgetType !== "ALL" ? { budgetType: budgetType as any } : {}),
      entityGL: {
        ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
      },
    },
    include: {
      monthlyLines: { where: { month: { gte: fromMonth, lte: toMonth } } },
      actualLines:  { where: { month: { gte: fromMonth, lte: toMonth } } },
      entityGL:     { include: { glAccount: true, entity: true } },
    },
    orderBy: [
      { entityGL: { entity: { code: "asc" } } },
      { entityGL: { glAccount: { code: "asc" } } },
    ],
  });

  const FIELD_LABELS: Record<string, string> = {
    entity:        "Entity",
    glCode:        "GL Code",
    glName:        "GL Account Name",
    category:      "Category",
    budgetType:    "Budget Type",
    annualBudget:  `Annual Budget (₦)`,
    monthlyBudget: `Budget ${MONTHS[fromMonth - 1]}–${MONTHS[toMonth - 1]} (₦)`,
    actualSpend:   `Actual Spend ${MONTHS[fromMonth - 1]}–${MONTHS[toMonth - 1]} (₦)`,
    balance:       "Balance (₦)",
    utilisation:   "Utilisation (%)",
    status:        "Status",
    financialYear: "Financial Year",
  };

  const rows: string[][] = [];

  rows.push(fields.map((f) => FIELD_LABELS[f] ?? f));

  for (const b of budgets) {
    const ytdBudget = b.monthlyLines.reduce((s, l) => s + Number(l.amount), 0);
    const ytdActual = b.actualLines.reduce( (s, l) => s + Number(l.amount), 0);
    const balance   = ytdBudget - ytdActual;
    const util      = ytdBudget > 0 ? Math.round((ytdActual / ytdBudget) * 100) : 0;

    const rowData: Record<string, string> = {
      entity:        b.entityGL.entity.name,
      glCode:        b.entityGL.glAccount.code,
      glName:        b.entityGL.glAccount.name,
      category:      b.entityGL.glAccount.category,
      budgetType:    b.budgetType,
      annualBudget:  Number(b.annualAmount).toFixed(2),
      monthlyBudget: ytdBudget.toFixed(2),
      actualSpend:   ytdActual.toFixed(2),
      balance:       balance.toFixed(2),
      utilisation:   `${util}%`,
      status:        b.status,
      financialYear: String(b.financialYear),
    };

    rows.push(fields.map((f) => `"${(rowData[f] ?? "").replace(/"/g, '""')}"`));
  }

  const csv = rows.map((r) => r.join(",")).join("\r\n");

  const filename = `addosser_budget_${financialYear}_${MONTHS[fromMonth-1]}_${MONTHS[toMonth-1]}.csv`;

  return new NextResponse(csv, {
    status:  200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
