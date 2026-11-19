import { prisma } from "./prisma";
import { getTellerRoleIds, getSupervisorRoleIds, getPaymentCapsForRole } from "@/lib/payment-access";
import { getBaseUrl } from "./base-url";
import {
  sendPaymentAssignedEmail,
  sendPaymentSubmittedForApprovalEmail,
  sendVendorPaymentEmail,
  sendPaymentRejectedEmail,
  sendInvoiceFullyPaidEmail,
} from "./payment-emails";
import { broadcastToUser, broadcastToUsers } from "./sse";

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getPaymentQueue(allowedEntityIds: string[] | null) {
  return prisma.invoice.findMany({
    where: {
      approvalStatus: "FULLY_APPROVED",
      status: "APPROVED",
      paymentBatches: { none: { status: { not: "CANCELLED" } } },
      ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
    },
    include: {
      vendor: {
        select: {
          name: true,
          email: true,
          bankName: true,
          bankAccountNo: true,
        },
      },
      entity: { select: { name: true, code: true } },
      submittedBy: { select: { name: true, email: true } },
    },

    orderBy: { updatedAt: "asc" },
  });
}

export async function getAvailableTellers(entityId: string) {
  const roleIds = await getTellerRoleIds();
  if (roleIds.length === 0) return [];
  return prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      OR: [{ entityId }, { entityAccess: { some: { entityId } } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      role: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function getApproversForEntity(entityId: string) {
  const roleIds = await getSupervisorRoleIds();
  if (roleIds.length === 0) return [];
  return prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      OR: [{ entityId }, { entityAccess: { some: { entityId } } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
    },
  });
}

export async function getMyTellerTasks(tellerId: string) {
  return prisma.paymentBatch.findMany({
    where: { tellerId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    include: {
      invoice: {
        include: {
          vendor: true,
          entity: { select: { name: true, code: true } },
        },
      },
      tranches: { orderBy: { trancheNumber: "asc" } },
    },
    orderBy: { assignedAt: "asc" },
  });
}

export async function getMyApprovalQueue(
  approverId: string,
  allowedEntityIds: string[] | null,
) {
  return prisma.paymentTranche.findMany({
    where: {
      status: "SUBMITTED",
      processedById: { not: approverId },
      approvals: { none: { approvedById: approverId } },
      paymentBatch: allowedEntityIds
        ? { entityId: { in: allowedEntityIds } }
        : undefined,
    },
    include: {
      paymentBatch: {
        include: {
          invoice: {
            include: {
              vendor: { select: { name: true } },
              entity: { select: { name: true, code: true } },
            },
          },
          teller: { select: { name: true } },
        },
      },
      approvals: { include: { approvedBy: { select: { name: true } } } },
    },
    orderBy: { submittedAt: "asc" },
  });
}

export async function getBatchDetail(batchId: string) {
  return prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      invoice: { include: { vendor: true, lineItems: true, entity: true } },
      assignedBy: { select: { name: true, email: true } },
      teller: { select: { name: true, email: true } },
      tranches: {
        orderBy: { trancheNumber: "asc" },
        include: {
          processedBy: { select: { name: true } },
          approvals: {
            include: { approvedBy: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

export async function assignPayment(params: {
  invoiceId: string;
  assignedById: string;
  assignedByRoleName: string;
  tellerId: string;
  instructions?: string;
  splits?: { percentage: number }[];
}) {
  const { batch, invoice, teller, trancheCount } = await prisma.$transaction(
    async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: params.invoiceId },
        include: {
          vendor: true,
          entity: { select: { name: true } },
          paymentBatches: { where: { status: { not: "CANCELLED" } } },
        },
      });
      if (!invoice) throw new PaymentError("Invoice not found", 404);
      if (
        invoice.approvalStatus !== "FULLY_APPROVED" ||
        invoice.status !== "APPROVED"
      ) {
        throw new PaymentError(
          "Invoice is not fully approved and cannot be queued for payment",
          400,
        );
      }
      if (invoice.paymentBatches.length > 0) {
        throw new PaymentError(
          "This invoice already has an active payment assignment",
          409,
        );
      }

      const teller = await tx.user.findUnique({
        where: { id: params.tellerId },
        include: {
          role: { include: { permissions: { include: { app: true } } } },
        },
      });
      if (!teller || !teller.isActive)
        throw new PaymentError("Selected Teller not found or inactive", 400);
      const tellerCanProcess = (
        await getPaymentCapsForRole(teller.roleId, teller.role.isSystem)
      ).process;
      if (!tellerCanProcess)
        throw new PaymentError(
          "Selected user does not have payment processing rights",
          400,
        );

      const totalAmount = round2(Number(invoice.amountPayable));
      const splits =
        params.splits && params.splits.length > 0
          ? params.splits
          : [{ percentage: 100 }];
      const isSplit = splits.length > 1;

      const pctSum = round2(splits.reduce((s, x) => s + x.percentage, 0));
      if (Math.abs(pctSum - 100) > 0.5) {
        throw new PaymentError(
          `Split percentages must sum to 100 (received ${pctSum})`,
          400,
        );
      }

      const batch = await tx.paymentBatch.create({
        data: {
          invoiceId: invoice.id,
          entityId: invoice.entityId,
          assignedById: params.assignedById,
          assignedByRoleName: params.assignedByRoleName,
          tellerId: params.tellerId,
          instructions: params.instructions || null,
          isSplitPayment: isSplit,
          totalAmount,
          status: "ASSIGNED",
        },
      });

      let allocated = 0;
      const trancheRows = splits.map((s, i) => {
        const isLast = i === splits.length - 1;
        const amount = isLast
          ? round2(totalAmount - allocated)
          : round2((s.percentage / 100) * totalAmount);
        allocated = round2(allocated + amount);
        return {
          paymentBatchId: batch.id,
          trancheNumber: i + 1,
          label: isSplit
            ? `Tranche ${i + 1} of ${splits.length} (${s.percentage}%)`
            : "Full Payment",
          plannedPercentage: s.percentage,
          plannedAmount: amount,
          bankName: invoice.vendor?.bankName ?? null,
          bankAccountNo: invoice.vendor?.bankAccountNo ?? null,
          bankAccountName: invoice.vendor?.bankAccountName ?? null,
        };
      });
      await tx.paymentTranche.createMany({ data: trancheRows });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAYMENT_PROCESSING" },
      });

      await tx.auditLog.create({
        data: {
          userId: params.assignedById,
          action: "PAYMENT_ASSIGNED",
          module: "payment",
          entityId: invoice.entityId,
          resourceId: batch.id,
          resourceType: "PaymentBatch",
          afterData: JSON.stringify({
            tellerId: params.tellerId,
            totalAmount,
            trancheCount: splits.length,
            isSplit,
          }),
        },
      });

      await tx.notification.create({
        data: {
          userId: params.tellerId,
          type: "ALERT",
          title: "New Payment Assignment",
          message: `You've been assigned to process payment for invoice ${invoice.invoiceNo} (${invoice.vendor?.name ?? invoice.vendorName}).`,
          actionUrl: "/payment/my-tasks",
        },
      });

      return { batch, invoice, teller, trancheCount: splits.length };
    },
  );

  await sendPaymentAssignedEmail({
    to: teller.email,
    tellerName: teller.name,
    assignedByName: params.assignedByRoleName,
    invoiceNo: invoice.invoiceNo,
    vendorName: invoice.vendorName,
    entityName: invoice.entity.name,
    totalAmount: Number(batch.totalAmount),
    trancheCount,
    instructions: params.instructions,
    actionUrl: `${getBaseUrl()}/payment/my-tasks`,
  });
  broadcastToUser(teller.id, "notification");
  broadcastToUser(invoice.submittedById, "invoice_update");

  return batch;
}

export async function processTranche(params: {
  trancheId: string;
  processedById: string;
  paymentMethod: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  transactionRef: string;
  proofOfPaymentUrl?: string;
  tellerNotes?: string;
}) {
  const { tranche, batch, invoice } = await prisma.$transaction(async (tx) => {
    const tranche = await tx.paymentTranche.findUnique({
      where: { id: params.trancheId },
      include: {
        paymentBatch: { include: { invoice: { include: { vendor: true } } } },
      },
    });
    if (!tranche) throw new PaymentError("Tranche not found", 404);
    if (tranche.paymentBatch.tellerId !== params.processedById) {
      throw new PaymentError(
        "You are not the Teller assigned to this payment",
        403,
      );
    }
    if (!["PENDING", "REJECTED"].includes(tranche.status)) {
      throw new PaymentError(
        `Tranche cannot be processed while in status ${tranche.status}`,
        400,
      );
    }

    const updated = await tx.paymentTranche.update({
      where: { id: params.trancheId },
      data: {
        paymentMethod: params.paymentMethod as any,
        bankName: params.bankName ?? tranche.bankName,
        bankAccountNo: params.bankAccountNo ?? tranche.bankAccountNo,
        bankAccountName: params.bankAccountName ?? tranche.bankAccountName,
        transactionRef: params.transactionRef,
        proofOfPaymentUrl: params.proofOfPaymentUrl,
        tellerNotes: params.tellerNotes || null,
        processedById: params.processedById,
        processedAt: new Date(),
        status: "SUBMITTED",
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });

    if (tranche.paymentBatch.status === "ASSIGNED") {
      await tx.paymentBatch.update({
        where: { id: tranche.paymentBatchId },
        data: { status: "IN_PROGRESS" },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: params.processedById,
        action: "PAYMENT_TRANCHE_SUBMITTED",
        module: "payment",
        entityId: tranche.paymentBatch.entityId,
        resourceId: tranche.id,
        resourceType: "PaymentTranche",
        afterData: JSON.stringify({
          transactionRef: params.transactionRef,
          amount: Number(tranche.plannedAmount),
        }),
      },
    });

    return {
      tranche: updated,
      batch: tranche.paymentBatch,
      invoice: tranche.paymentBatch.invoice,
    };
  });

  const approvers = await getApproversForEntity(batch.entityId);
  const processedByUser = await prisma.user.findUnique({
    where: { id: params.processedById },
    select: { name: true },
  });

  await prisma.notification.createMany({
    data: approvers.map((a) => ({
      userId: a.id,
      type: "APPROVAL" as const,
      title: "Payment Awaiting Approval",
      message: `${processedByUser?.name ?? "A Teller"} submitted ${tranche.label ?? "a payment"} for invoice ${invoice.invoiceNo}.`,
      actionUrl: "/payment/approvals",
    })),
  });

  await Promise.all(
    approvers.map((a) =>
      sendPaymentSubmittedForApprovalEmail({
        to: a.email,
        approverName: a.name,
        invoiceNo: invoice.invoiceNo,
        vendorName: invoice.vendor?.name ?? invoice.vendorName,
        trancheLabel: tranche.label ?? "Full Payment",
        amount: Number(tranche.plannedAmount),
        transactionRef: tranche.transactionRef,
        processedByName: processedByUser?.name ?? "Teller",
        actionUrl: `${getBaseUrl()}/payment/approvals`,
      }),
    ),
  );

  broadcastToUsers(
    approvers.map((a) => a.id),
    "notification",
  );

  return tranche;
}

export async function actionTrancheApproval(params: {
  trancheId: string;
  approverId: string;
  approverRoleName: string;
  approverEmail: string;
  approverName: string;
  action: "APPROVED" | "REJECTED";
  comment?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const tranche = await tx.paymentTranche.findUnique({
      where: { id: params.trancheId },
      include: {
        paymentBatch: {
          include: {
            invoice: {
              include: {
                vendor: true,
                submittedBy: true,
                entity: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!tranche) throw new PaymentError("Tranche not found", 404);
    if (tranche.processedById === params.approverId) {
      throw new PaymentError(
        "You processed this payment — a different approver must review it",
        403,
      );
    }

    const existing = await tx.paymentApproval.findUnique({
      where: {
        paymentTrancheId_approvedById: {
          paymentTrancheId: tranche.id,
          approvedById: params.approverId,
        },
      },
    });
    if (existing)
      throw new PaymentError("You have already actioned this payment", 409);

    const updateResult = await tx.paymentTranche.updateMany({
      where: { id: tranche.id, status: "SUBMITTED" },
      data:
        params.action === "APPROVED"
          ? {
              status: "PAID",
              paidAt: new Date(),
              approvedAmount: tranche.plannedAmount,
            }
          : {
              status: "REJECTED",
              rejectedAt: new Date(),
              rejectionReason: params.comment || "No reason provided",
            },
    });

    if (updateResult.count === 0) {
      throw new PaymentError(
        "This payment was already actioned by another approver",
        409,
      );
    }

    await tx.paymentApproval.create({
      data: {
        paymentTrancheId: tranche.id,
        approvedById: params.approverId,
        roleName: params.approverRoleName,
        action: params.action,
        comment: params.comment || null,
        isDecisive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: params.approverId,
        action:
          params.action === "APPROVED"
            ? "PAYMENT_APPROVED"
            : "PAYMENT_REJECTED",
        module: "payment",
        entityId: tranche.paymentBatch.entityId,
        resourceId: tranche.id,
        resourceType: "PaymentTranche",
        afterData: JSON.stringify({ comment: params.comment ?? null }),
      },
    });

    let batchCompleted = false;
    const allTranches = await tx.paymentTranche.findMany({
      where: { paymentBatchId: tranche.paymentBatchId },
    });

    if (params.action === "APPROVED") {
      const disbursed = allTranches.reduce(
        (sum, t) =>
          sum +
          (t.status === "PAID"
            ? Number(t.approvedAmount ?? t.plannedAmount)
            : 0),
        0,
      );
      const allPaid = allTranches.every((t) => t.status === "PAID");

      await tx.paymentBatch.update({
        where: { id: tranche.paymentBatchId },
        data: {
          amountDisbursed: round2(disbursed),
          status: allPaid ? "COMPLETED" : "IN_PROGRESS",
          completedAt: allPaid ? new Date() : null,
        },
      });

      await tx.invoice.update({
        where: { id: tranche.paymentBatch.invoiceId },
        data: allPaid
          ? {
              status: "PAID",
              paidAt: new Date(),
              paymentRef: allTranches
                .map((t) => t.transactionRef)
                .filter(Boolean)
                .join(", "),
            }
          : { status: "PARTIALLY_PAID" },
      });

      batchCompleted = allPaid;
    }

    return { tranche, batchCompleted, allTranches };
  });

  const { tranche, batchCompleted, allTranches } = result;
  const batch = tranche.paymentBatch;
  const invoice = batch.invoice;
  const vendorEmail = invoice.vendor?.email ?? invoice.vendorEmail;

  if (params.action === "APPROVED") {
    const disbursed = allTranches.reduce(
      (sum, t) =>
        sum +
        (t.status === "PAID" ? Number(t.approvedAmount ?? t.plannedAmount) : 0),
      0,
    );
    const remaining = round2(Number(batch.totalAmount) - disbursed);

    if (vendorEmail) {
      await sendVendorPaymentEmail({
        to: vendorEmail,
        vendorName: invoice.vendor?.name ?? invoice.vendorName,
        invoiceNo: invoice.invoiceNo,
        entityName: invoice.entity.name,
        amountPaid: Number(tranche.plannedAmount),
        transactionRef: tranche.transactionRef,
        paymentMethod: tranche.paymentMethod ?? undefined,
        isFinalTranche: batchCompleted,
        remainingBalance: batchCompleted ? undefined : remaining,
      });
    }

    await prisma.notification.create({
      data: {
        userId: batch.tellerId,
        type: "SUCCESS",
        title: "Payment Approved",
        message: `${tranche.label ?? "Payment"} for invoice ${invoice.invoiceNo} was approved by ${params.approverName}.`,
        actionUrl: `/payment/${batch.id}`,
      },
    });

    if (batchCompleted) {
      await prisma.notification.create({
        data: {
          userId: invoice.submittedById,
          type: "SUCCESS",
          title: "Invoice Fully Paid",
          message: `Invoice ${invoice.invoiceNo} has been fully paid.`,
          actionUrl: `/invoice/${invoice.id}`,
        },
      });
      if (invoice.submittedBy?.email) {
        await sendInvoiceFullyPaidEmail({
          to: invoice.submittedBy.email,
          submitterName: invoice.submittedBy.name,
          invoiceNo: invoice.invoiceNo,
          totalAmount: Number(batch.totalAmount),
          actionUrl: `${getBaseUrl()}/invoice/${invoice.id}`,
        });
      }
      broadcastToUser(invoice.submittedById, "invoice_update");
    }

    broadcastToUser(batch.tellerId, "notification");
  } else {
    const teller = await prisma.user.findUnique({
      where: { id: batch.tellerId },
    });
    if (teller) {
      await prisma.notification.create({
        data: {
          userId: teller.id,
          type: "WARNING",
          title: "Payment Rejected",
          message: `${tranche.label ?? "Payment"} for invoice ${invoice.invoiceNo} was rejected by ${params.approverName}.`,
          actionUrl: "/payment/my-tasks",
        },
      });
      await sendPaymentRejectedEmail({
        to: teller.email,
        tellerName: teller.name,
        invoiceNo: invoice.invoiceNo,
        trancheLabel: tranche.label ?? "Full Payment",
        rejectedByName: params.approverName,
        reason: params.comment || "No reason provided",
        actionUrl: `${getBaseUrl()}/payment/my-tasks`,
      });
      broadcastToUser(teller.id, "notification");
    }
  }

  return result;
}

export async function cancelPaymentBatch(params: {
  batchId: string;
  cancelledById: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.paymentBatch.findUnique({
      where: { id: params.batchId },
    });
    if (!batch) throw new PaymentError("Payment batch not found", 404);
    if (batch.status === "COMPLETED")
      throw new PaymentError("A completed payment cannot be cancelled", 400);

    await tx.paymentBatch.update({
      where: { id: params.batchId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: params.reason,
      },
    });
    await tx.invoice.update({
      where: { id: batch.invoiceId },
      data: { status: "APPROVED" },
    });
    await tx.auditLog.create({
      data: {
        userId: params.cancelledById,
        action: "PAYMENT_BATCH_CANCELLED",
        module: "payment",
        entityId: batch.entityId,
        resourceId: batch.id,
        resourceType: "PaymentBatch",
        afterData: JSON.stringify({ reason: params.reason }),
      },
    });
    return batch;
  });
}
