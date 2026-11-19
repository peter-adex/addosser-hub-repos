import { getPaymentCaps, getPaymentCapsForRole } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentError } from "@/lib/payment";
import { getBaseUrl } from "@/lib/base-url";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  newTellerId: z.string().min(1),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const user = session.user as any;

  const perm = await getPaymentCaps(user);
  if (!perm.assign && !user.isSystem) {
    return NextResponse.json({ error: "You do not have permission to reassign payments" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err.errors?.[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const batch = await prisma.paymentBatch.findUnique({
    where: { id: params.batchId },
    include: {
      invoice: { select: { invoiceNo: true, vendorName: true } },
      tranches: { select: { status: true } },
    },
  });
  if (!batch) return NextResponse.json({ error: "Payment batch not found" }, { status: 404 });

  const hasStarted = batch.tranches.some((t) => ["SUBMITTED", "PAID"].includes(t.status));
  if (hasStarted) {
    return NextResponse.json(
      { error: "Cannot reassign — the current Teller has already submitted at least one tranche" },
      { status: 409 }
    );
  }

  const newTeller = await prisma.user.findUnique({
    where: { id: body.newTellerId },
    include: {
      role: { include: { permissions: { include: { app: true } } } },
    },
  });
  if (!newTeller || !newTeller.isActive) {
    return NextResponse.json({ error: "Selected Teller not found or inactive" }, { status: 400 });
  }
  const canProcess = (await getPaymentCapsForRole(newTeller.roleId, newTeller.role.isSystem)).process;
  if (!canProcess) {
    return NextResponse.json({ error: "Selected user does not have Teller processing rights" }, { status: 400 });
  }

  const oldTellerId = batch.tellerId;

  await prisma.$transaction(async (tx) => {
    await tx.paymentBatch.update({
      where: { id: params.batchId },
      data: { tellerId: body.newTellerId, status: "ASSIGNED" },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT_REASSIGNED",
        module: "payment",
        entityId: batch.entityId,
        resourceId: batch.id,
        resourceType: "PaymentBatch",
        afterData: JSON.stringify({
          oldTellerId,
          newTellerId: body.newTellerId,
          reason: body.reason ?? null,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: body.newTellerId,
        type: "ALERT",
        title: "Payment Assigned to You",
        message: `Invoice ${batch.invoice.invoiceNo} (${batch.invoice.vendorName}) has been assigned to you by ${user.roleName ?? "Payment Head"}.${body.reason ? ` Note: ${body.reason}` : ""}`,
        actionUrl: "/payment/my-tasks",
      },
    });

    if (oldTellerId && oldTellerId !== body.newTellerId) {
      await tx.notification.create({
        data: {
          userId: oldTellerId,
          type: "INFO",
          title: "Payment Reassigned",
          message: `Invoice ${batch.invoice.invoiceNo} has been reassigned to another Teller.`,
          actionUrl: "/payment/my-tasks",
        },
      });
    }
  });

  try {
    const { sendPaymentAssignedEmail } = await import("@/lib/payment-emails");
    await sendPaymentAssignedEmail({
      to: newTeller.email,
      tellerName: newTeller.name,
      assignedByName: user.roleName ?? "Payment Head",
      invoiceNo: batch.invoice.invoiceNo,
      vendorName: batch.invoice.vendorName,
      entityName: batch.entityId,
      totalAmount: Number(batch.totalAmount),
      trancheCount: batch.tranches.length,
      instructions: body.reason ? `Reassignment reason: ${body.reason}` : undefined,
      actionUrl: `${getBaseUrl()}/payment/my-tasks`,
    });
  } catch {
  }

  try {
    const { broadcastToUser } = await import("@/lib/sse");
    broadcastToUser(body.newTellerId, "notification");
    if (oldTellerId) broadcastToUser(oldTellerId, "notification");
  } catch {}

  return NextResponse.json({ success: true });
}
