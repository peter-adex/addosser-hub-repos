import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RecallSchema = z.object({
  reason: z.string().min(1, "Please provide a reason for recalling").max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
  });

  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.submittedById !== userId) {
    return NextResponse.json(
      { error: "Only the original submitter can recall this invoice" },
      { status: 403 },
    );
  }

  if (invoice.status !== "PENDING") {
    const msg =
      invoice.status === "APPROVED"
        ? "Cannot recall — invoice has been fully approved"
        : invoice.status === "PAID"
          ? "Cannot recall — invoice has already been paid"
          : invoice.status === "RECALLED"
            ? "Invoice has already been recalled"
            : invoice.status === "REJECTED"
              ? "Invoice was rejected — edit and resubmit instead"
              : `Cannot recall an invoice in "${invoice.status.replace(/_/g, " ")}" status`;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const activeInstance = await prisma.approvalInstance.findFirst({
    where: {
      resourceId: params.id,
      resourceType: "Invoice",
      status: "IN_PROGRESS",
    },
    include: {
      steps: {
        orderBy: {
          stepNumber: "asc",
        },
      },
    },
  });

  if (!activeInstance) {
    return NextResponse.json(
      {
        error: "Approval workflow instance not found",
      },
      { status: 409 },
    );
  }

  const firstStep = activeInstance.steps.find((s) => s.stepNumber === 1);

  if (firstStep?.status === "APPROVED") {
    return NextResponse.json(
      {
        error:
          "Cannot recall — the first approver has already approved this invoice",
      },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = RecallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: params.id },
      data: {
        status: "RECALLED",
        approvalStatus: "RECALLED",
        recalledAt: new Date(),
        recallReason: parsed.data.reason,
      },
    });

    if (activeInstance) {
      await tx.approvalInstance.update({
        where: { id: activeInstance.id },
        data: { status: "CANCELLED" as any, completedAt: new Date() },
      });
      await tx.approvalInstanceStep.updateMany({
        where: {
          instanceId: activeInstance.id,
          status: { in: ["PENDING", "WAITING"] },
        },
        data: { status: "CANCELLED" as any },
      });
    }

    await tx.actualLine.deleteMany({ where: { invoiceId: params.id } });
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "INFO",
      title: "Invoice Recalled Successfully",
      message: `Invoice ${invoice.invoiceNo} has been recalled. You can edit and resubmit it.`,
      actionUrl: `/invoice/${params.id}/edit`,
    },
  });

  await logAudit({
    userId,
    action: "INVOICE_RECALLED",
    module: "invoice",
    entityId: invoice.entityId,
    resourceId: params.id,
    resourceType: "Invoice",
    afterData: JSON.stringify({ reason: parsed.data.reason }),
  });

  return NextResponse.json({
    success: true,
    message: "Invoice recalled. You can now edit and resubmit it.",
  });
}
