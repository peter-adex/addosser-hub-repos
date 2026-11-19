import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasEntityAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const txn = await prisma.gLTransaction.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { id: true, name: true, code: true } },
      glAccount: { select: { code: true, name: true, category: true } },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      journalEntry: { select: { id: true, description: true, referenceNo: true, status: true } },
      invoice: {
        include: {
          vendor: { select: { name: true } },
          submittedBy: { select: { name: true, email: true, jobTitle: true, department: true } },
          entity: { select: { name: true, code: true } },
          asset: {
            select: {
              id: true, assetNo: true, name: true, status: true, purchaseDate: true,
              classification: { select: { name: true } },
            },
          },
        },
      },
      asset: {
        select: {
          id: true, assetNo: true, name: true, status: true, purchaseDate: true,
          classification: { select: { name: true } },
        },
      },
    },
  });
  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (!(await userHasEntityAccess(txn.entityId))) {
    return NextResponse.json({ error: "You do not have access to this entity" }, { status: 403 });
  }

  const approvalInstanceId = txn.invoice?.approvalInstanceId ?? txn.approvalInstanceId ?? null;
  const approvalInstance = approvalInstanceId
    ? await prisma.approvalInstance.findUnique({
        where: { id: approvalInstanceId },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            include: { actionedBy: { select: { name: true, email: true } } },
          },
        },
      })
    : null;

  const assetId = txn.assetId ?? txn.invoice?.assetId ?? null;
  const assetHistorySummary = assetId
    ? await (await import("@/lib/asset-cost-history")).getAssetCostHistory(assetId, { limit: 5 })
    : null;

  return NextResponse.json({
    success: true,
    data: {
      transaction: txn,
      approvalInstance,
      assetHistorySummary: assetHistorySummary
        ? { summary: assetHistorySummary.summary, recentRows: assetHistorySummary.rows.slice(0, 5) }
        : null,
    },
  });
}
