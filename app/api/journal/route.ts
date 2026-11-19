import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.view('journal') && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const allowedEntityIds = user.isSystem ? null : (user.allowedEntityIds ?? null);
    const { searchParams } = new URL(req.url);

    const entryRef   = searchParams.get("entryRef")   || "";
    const invoiceNo  = searchParams.get("invoiceNo")  || "";
    const vendorName = searchParams.get("vendorName") || "";
    const entityId   = searchParams.get("entityId")   || "";
    const dateFrom   = searchParams.get("dateFrom")   || "";
    const dateTo     = searchParams.get("dateTo")     || "";

    const where: any = {
      ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
      ...(entityId && entityId !== "ALL" ? { entityId } : {}),
      ...(entryRef.trim()   ? { entryRef:   { contains: entryRef }   } : {}),
      ...(invoiceNo.trim()  ? { invoiceNo:  { contains: invoiceNo }  } : {}),
      ...(vendorName.trim() ? { vendorName: { contains: vendorName } } : {}),
    };

    if (dateFrom || dateTo) {
      where.entryDate = {};
      if (dateFrom) where.entryDate.gte = new Date(dateFrom);
      if (dateTo)   where.entryDate.lte = new Date(dateTo + "T23:59:59");
    }

    const [entries, entities] = await Promise.all([
      prisma.paymentJournalEntry.findMany({
        where,
        include: {
          entity: { select: { name: true, code: true } },
          paymentBatch: {
            select: { id: true, isSplitPayment: true, totalAmount: true },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { entryDate: "desc" },
        take: 500,
      }),
      prisma.entity.findMany({
        where: {
          isActive: true,
          ...(allowedEntityIds ? { id: { in: allowedEntityIds } } : {}),
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const totalDebit  = entries.reduce((s, e) => s + Number(e.grossAmount), 0);
    const totalCredit = entries.reduce((s, e) => s + Number(e.netAmount),   0);

    return NextResponse.json({ entries, entities, totalDebit, totalCredit });
  } catch (err: any) {
    console.error("[GET /api/journal]", err);
    return NextResponse.json({ error: "Failed to load journal entries" }, { status: 500 });
  }
}
