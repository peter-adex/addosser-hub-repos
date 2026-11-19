import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escalateInvoice } from "@/lib/payment-v2";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason:  z.string().min(10, "Please provide a reason of at least 10 characters"),
  comment: z.string().optional(),
});

export async function POST(
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

    if (!perm.assign && !perm.approve && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const batch = await prisma.paymentBatch.findUnique({
      where: { id: params.batchId },
      select: { invoiceId: true, entityId: true, status: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Payment batch not found" }, { status: 404 });
    }

    const allowedIds: string[] = user.isSystem
      ? []
      : user.allowedEntityIds ?? [user.entityId];
    if (!user.isSystem && !allowedIds.includes(batch.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (batch.status === "COMPLETED" || batch.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Cannot escalate a payment in ${batch.status} status.` },
        { status: 400 }
      );
    }

    const body = bodySchema.parse(await req.json());

    const escalation = await escalateInvoice({
      invoiceId:       batch.invoiceId,
      escalatedById:   user.id,
      escalatedByRole: user.roleName,
      reason:          body.reason,
      comment:         body.comment,
    });

    return NextResponse.json({ success: true, escalationId: escalation.id }, { status: 201 });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Validation failed" }, { status: 400 });
    }
    console.error("[POST /api/payment/:batchId/escalate]", err);
    return NextResponse.json({ error: err.message ?? "Escalation failed" }, { status: 500 });
  }
}
