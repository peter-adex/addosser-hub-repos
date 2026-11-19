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
  const q = (searchParams.get("q") ?? "").trim();
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
  const budgetTypeParam = searchParams.get("budgetType");
  const requireBudget = (searchParams.get("requireBudget") ?? "true") !== "false";
  const category = searchParams.get("category")?.trim();

  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }

  const entityAccounts = await prisma.entityGLAccount.findMany({
    where: {
      entityId,
      isActive: true,
      glAccount: {
        isActive: true,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q } },
                { name: { contains: q } },
                { category: { contains: q } },
              ],
            }
          : {}),
      },
      ...(requireBudget
        ? {
            budgets: {
              some: {
                financialYear: year,
                status: { in: ["APPROVED", "ACTIVE"] },
                ...(budgetTypeParam && budgetTypeParam !== "ALL" ? { budgetType: budgetTypeParam as any } : {}),
              },
            },
          }
        : {}),
    },
    include: {
      glAccount: true,
      entity: { select: { id: true, code: true } },
      budgets: {
        where: { financialYear: year, status: { in: ["APPROVED", "ACTIVE"] } },
        select: { budgetType: true },
      },
    },
    take: 20,
    orderBy: { glAccount: { code: "asc" } },
  });

  const results = entityAccounts.map((ea) => ({
    id: `${ea.glAccountId}_${ea.entityId}`,
    glAccountId: ea.glAccountId,
    budgetEntityId: ea.entityId,
    code: ea.glAccount.code,
    name: `${ea.glAccount.name} (${ea.entity.code})`,
    category: ea.glAccount.category,
    budgetType: ea.budgets[0]?.budgetType ?? "OPEX",
    hasBudget: ea.budgets.length > 0,
  }));

  return NextResponse.json({ success: true, data: results });
}
