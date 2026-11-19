import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postTrancheJournal } from "@/lib/payment-journal";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(
  req: NextRequest,
  { params }: { params: { trancheId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.approve && !user.isSystem) {
      return NextResponse.json(
        { error: "You do not have payment approval rights" },
        { status: 403 },
      );
    }

    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
    } catch (err: any) {
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Invalid body" },
        { status: 400 },
      );
    }

    if (body.action === "REJECTED" && !body.comment?.trim()) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const tranche = await prisma.paymentTranche.findUnique({
      where: { id: params.trancheId },
      include: {
        paymentBatch: {
          include: {
            invoice: {
              include: {
                vendor: { select: { name: true, email: true } },
                entity: { select: { name: true } },
                submittedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        approvals: { select: { approvedById: true } },
      },
    });

    if (!tranche) {
      return NextResponse.json({ error: "Tranche not found" }, { status: 404 });
    }

    if (tranche.processedById === user.id) {
      return NextResponse.json(
        {
          error:
            "You processed this payment — a different approver must verify it",
        },
        { status: 403 },
      );
    }

    if (tranche.approvals.some((a) => a.approvedById === user.id)) {
      return NextResponse.json(
        { error: "You have already actioned this tranche" },
        { status: 409 },
      );
    }

    if (tranche.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Tranche is ${tranche.status} — cannot action` },
        { status: 400 },
      );
    }

    const now = new Date();
    const updateResult = await prisma.paymentTranche.updateMany({
      where: { id: tranche.id, status: "SUBMITTED" },
      data:
        body.action === "APPROVED"
          ? {
              status: "PAID",
              paidAt: now,
              approvedAmount: tranche.plannedAmount,
            }
          : {
              status: "REJECTED",
              rejectedAt: now,
              rejectionReason: body.comment,
            },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: "This tranche was already actioned by another approver" },
        { status: 409 },
      );
    }

    await prisma.paymentApproval.upsert({
      where: {
        paymentTrancheId_approvedById: {
          paymentTrancheId: tranche.id,
          approvedById: user.id,
        },
      },
      update: {},
      create: {
        paymentTrancheId: tranche.id,
        approvedById: user.id,
        roleName: user.roleName ?? "",
        action: body.action,
        comment: body.comment ?? null,
        isDecisive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action:
          body.action === "APPROVED"
            ? "PAYMENT_TRANCHE_APPROVED"
            : "PAYMENT_TRANCHE_REJECTED",
        module: "payment",
        entityId: tranche.paymentBatch.entityId,
        resourceId: tranche.id,
        resourceType: "PaymentTranche",
        afterData: JSON.stringify({
          action: body.action,
          comment: body.comment,
        }),
      },
    });

    let batchCompleted = false;
    const inv = tranche.paymentBatch.invoice;

    if (body.action === "APPROVED") {
      const allTranches = await prisma.paymentTranche.findMany({
        where: { paymentBatchId: tranche.paymentBatchId },
      });
      const disbursed = allTranches.reduce(
        (s, t) =>
          s +
          (t.status === "PAID"
            ? Number(t.approvedAmount ?? t.plannedAmount)
            : 0),
        0,
      );
      batchCompleted = allTranches.every((t) => t.status === "PAID");

      await prisma.paymentBatch.update({
        where: { id: tranche.paymentBatchId },
        data: {
          amountDisbursed: round2(disbursed),
          status: batchCompleted ? "COMPLETED" : "IN_PROGRESS",
          completedAt: batchCompleted ? now : null,
        },
      });

      await prisma.invoice.update({
        where: { id: tranche.paymentBatch.invoiceId },
        data: batchCompleted
          ? {
              status: "PAID",
              paidAt: now,
              paymentRef: allTranches
                .map((t) => t.transactionRef)
                .filter(Boolean)
                .join(", "),
            }
          : { status: "PARTIALLY_PAID" },
      });

      try {
        await postTrancheJournal(tranche.id, user.id);
      } catch (je) {
        console.error("[approve] Journal posting failed (non-fatal):", je);
      }

      await prisma.notification.create({
        data: {
          userId: tranche.paymentBatch.tellerId,
          type: "SUCCESS",
          title: "Payment Approved ✅",
          message: `${tranche.label ?? "Payment"} for invoice ${inv.invoiceNo} was approved by ${user.name}.`,
          actionUrl: `/payment/my-tasks`,
        },
      });

      if (batchCompleted) {
        await prisma.notification.create({
          data: {
            userId: inv.submittedBy.id,
            type: "SUCCESS",
            title: "Invoice Fully Paid 🎉",
            message: `Invoice ${inv.invoiceNo} has been fully paid.`,
            actionUrl: `/invoice/${inv.id}`,
          },
        });
      }

      const vendorEmail = inv.vendor?.email ?? inv.vendorEmail;
      if (vendorEmail) {
        try {
          const { sendVendorPaymentEmail } =
            await import("@/lib/payment-emails");
          await sendVendorPaymentEmail({
            to: vendorEmail,
            vendorName: inv.vendor?.name ?? inv.vendorName,
            invoiceNo: inv.invoiceNo,
            entityName: inv.entity.name,
            amountPaid: Number(tranche.plannedAmount),
            transactionRef: tranche.transactionRef,
            paymentMethod: tranche.paymentMethod ?? undefined,
            isFinalTranche: batchCompleted,
            remainingBalance: batchCompleted
              ? undefined
              : round2(Number(tranche.paymentBatch.totalAmount) - disbursed),
          });
        } catch {
        }
      }
    }

    if (body.action === "REJECTED") {
      await prisma.notification.create({
        data: {
          userId: tranche.paymentBatch.tellerId,
          type: "WARNING",
          title: "Payment Returned ⚠️",
          message: `${tranche.label ?? "Payment"} for invoice ${inv.invoiceNo} was rejected. Reason: ${body.comment}`,
          actionUrl: "/payment/my-tasks",
        },
      });
    }

    try {
      const { broadcastToUser } = await import("@/lib/sse");
      broadcastToUser(tranche.paymentBatch.tellerId, "notification");
      if (batchCompleted) broadcastToUser(inv.submittedBy.id, "invoice_update");
    } catch {}

    return NextResponse.json({ success: true, batchCompleted });
  } catch (err: any) {
    console.error("[POST /api/payment/tranches/[trancheId]/approve]", err);
    return NextResponse.json(
      { error: err.message || "Action failed" },
      { status: 500 },
    );
  }
}
