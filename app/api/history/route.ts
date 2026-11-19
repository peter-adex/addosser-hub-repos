import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const user = session.user as any;
    const perm = await getPaymentCaps(user);
    if (!perm.view('history') && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    const allowedEntityIds: string[] = user.isSystem
      ? []
      : user.allowedEntityIds ?? [user.entityId];

    const entityFilter = sp.get("entity") ? sp.get("entity")! : undefined;

    const where: Prisma.PaymentTrancheWhereInput = {
      paymentBatch: {
        ...(entityFilter
          ? { entityId: entityFilter }
          : !user.isSystem
          ? { entityId: { in: allowedEntityIds } }
          : {}),
        invoice: {
          ...(sp.get("vendor")
            ? {
                OR: [
                  { vendorName: { contains: sp.get("vendor")! } },
                  { vendor: { name: { contains: sp.get("vendor")! } } },
                ],
              }
            : {}),
          ...(sp.get("invoiceNo")
            ? { invoiceNo: { contains: sp.get("invoiceNo")! } }
            : {}),
          ...(sp.get("description")
            ? { description: { contains: sp.get("description")! } }
            : {}),
        },
      },
      ...(sp.get("paymentRef")
        ? { transactionRef: { contains: sp.get("paymentRef")! } }
        : {}),
      ...(sp.get("status") ? { status: sp.get("status") as any } : {}),
      ...(sp.get("dateFrom") || sp.get("dateTo")
        ? {
            paidAt: {
              ...(sp.get("dateFrom") ? { gte: new Date(sp.get("dateFrom")!) } : {}),
              ...(sp.get("dateTo") ? { lte: new Date(sp.get("dateTo")!) } : {}),
            },
          }
        : {}),
      ...(sp.get("amountMin") || sp.get("amountMax")
        ? {
            plannedAmount: {
              ...(sp.get("amountMin")
                ? { gte: parseFloat(sp.get("amountMin")!) }
                : {}),
              ...(sp.get("amountMax")
                ? { lte: parseFloat(sp.get("amountMax")!) }
                : {}),
            },
          }
        : {}),
    };

    const [tranches, total] = await Promise.all([
      prisma.paymentTranche.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: "desc" },
        include: {
          proofs: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              fileUrl: true,
              uploadedAt: true,
            },
          },
          paymentBatch: {
            include: {
              entity: { select: { id: true, name: true, code: true } },
              teller: { select: { name: true } },
              assignedBy: { select: { name: true } },
              invoice: {
                include: {
                  vendor: {
                    select: {
                      name: true,
                      bankAccountNo: true,
                      bankName: true,
                    },
                  },
                  submittedBy: { select: { name: true } },
                },
              },
            },
          },
          approvals: {
            where: { isDecisive: true },
            include: { approvedBy: { select: { name: true } } },
          },
        },
      }),
      prisma.paymentTranche.count({ where }),
    ]);

    return NextResponse.json({
      data: tranches,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    console.error("[GET /api/payment/history]", err);
    return NextResponse.json({ error: "Failed to fetch payment history" }, { status: 500 });
  }
}
