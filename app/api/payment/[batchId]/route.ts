import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.view() && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const batch = await prisma.paymentBatch.findUnique({
      where: { id: params.batchId },
      include: {
        assignedBy: { select: { name: true, email: true } },
        teller:     { select: { name: true, email: true } },
        invoice: {
          include: {
            vendor:    true,
            entity:    { select: { name: true, code: true } },
            glAccount: { select: { code: true, name: true } },
            lineItems: { orderBy: { sortOrder: "asc" } },
            submittedBy: { select: { name: true } },
          },
        },
        tranches: {
          orderBy: { trancheNumber: "asc" },
          include: {
            processedBy: { select: { name: true } },
            proofs:      { orderBy: { uploadedAt: "desc" } },
            approvals:   {
              include: { approvedBy: { select: { name: true } } },
              orderBy:  { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Payment batch not found" }, { status: 404 });
    }

    return NextResponse.json(batch);
  } catch (err: any) {
    console.error("[GET /api/payment/[batchId]]", err);
    return NextResponse.json({ error: "Failed to load batch" }, { status: 500 });
  }
}
