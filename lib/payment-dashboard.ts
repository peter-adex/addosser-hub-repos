import { prisma } from "./prisma";
import { getHeadOrSupervisorRoleIds, getPaymentCapsForRole } from "./payment-access";
import { PaymentError } from "./payment";

export async function notifyPaymentQueueAdded(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      vendor: { select: { name: true } },
      entity: { select: { id: true, name: true } },
    },
  });
  if (!invoice) return;

  const roleIds = await getHeadOrSupervisorRoleIds();
  if (roleIds.length === 0) return;

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      OR: [
        { entityId: invoice.entityId },
        { entityAccess: { some: { entityId: invoice.entityId } } },
      ],
    },
    select: { id: true, name: true, email: true },
  });
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type: "ALERT" as const,
      title: "New Invoice Ready for Payment",
      message: `Invoice ${invoice.invoiceNo} (${
        invoice.vendor?.name ?? invoice.vendorName
      }) is fully approved and waiting in the payment queue.`,
      actionUrl: "/payment",
    })),
  });

  try {
    const { broadcastToUsers } = await import("./sse");
    broadcastToUsers(recipients.map((r) => r.id), "notification");
  } catch {
  }
}

export async function getHeadDashboardStats(allowedEntityIds: string[] | null) {
  const entityFilter = allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {};

  const [queueCount, assignedCount, processingCount, completedThisMonth, pendingApprovals] =
    await Promise.all([
      prisma.invoice.count({
        where: {
          approvalStatus: "FULLY_APPROVED",
          status: "APPROVED",
          paymentBatches: { none: { status: { not: "CANCELLED" } } },
          ...entityFilter,
        },
      }),
      prisma.paymentBatch.count({ where: { status: "ASSIGNED", ...entityFilter } }),
      prisma.paymentBatch.count({ where: { status: "IN_PROGRESS", ...entityFilter } }),
      prisma.paymentBatch.count({
        where: {
          status: "COMPLETED",
          completedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          ...entityFilter,
        },
      }),
      prisma.paymentTranche.count({
        where: { status: "SUBMITTED", paymentBatch: entityFilter },
      }),
    ]);

  return { queueCount, assignedCount, processingCount, completedThisMonth, pendingApprovals };
}

export async function getTellerDashboardStats(tellerId: string) {
  const tellerFilter = { tellerId };
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [assignedCount, pendingCount, submittedCount, paidToday, rejectedCount] =
    await Promise.all([
      prisma.paymentBatch.count({ where: { ...tellerFilter, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } }),
      prisma.paymentTranche.count({ where: { paymentBatch: tellerFilter, status: "PENDING" } }),
      prisma.paymentTranche.count({ where: { paymentBatch: tellerFilter, status: "SUBMITTED" } }),
      prisma.paymentTranche.count({
        where: { paymentBatch: tellerFilter, status: "PAID", paidAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.paymentTranche.count({ where: { paymentBatch: tellerFilter, status: "REJECTED" } }),
    ]);

  return { assignedCount, pendingCount, submittedCount, paidToday, rejectedCount };
}

export async function getAssignedBatches(allowedEntityIds: string[] | null) {
  return prisma.paymentBatch.findMany({
    where: {
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
    },
    include: {
      invoice: { include: { vendor: true, entity: { select: { name: true, code: true } } } },
      teller: { select: { id: true, name: true, email: true } },
      tranches: { orderBy: { trancheNumber: "asc" } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export async function reassignTeller(params: {
  batchId: string;
  newTellerId: string;
  reassignedById: string;
  reassignedByRoleName: string;
  reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.paymentBatch.findUnique({
      where: { id: params.batchId },
      include: { tranches: true, invoice: { select: { invoiceNo: true } } },
    });
    if (!batch) throw new PaymentError("Payment batch not found", 404);

    const started = batch.tranches.some((t) => ["SUBMITTED", "PAID"].includes(t.status));
    if (started) {
      throw new PaymentError(
        "Cannot reassign — the current Teller has already submitted at least one tranche for approval",
        409
      );
    }

    const newTeller = await tx.user.findUnique({
      where: { id: params.newTellerId },
      include: { role: { include: { permissions: { include: { app: true } } } } },
    });
    if (!newTeller || !newTeller.isActive) {
      throw new PaymentError("Selected Teller not found or inactive", 400);
    }
    const canProcess = (await getPaymentCapsForRole(newTeller.roleId, newTeller.role.isSystem)).process;
    if (!canProcess) {
      throw new PaymentError("Selected user does not have Teller processing rights", 400);
    }

    const oldTellerId = batch.tellerId;

    const updated = await tx.paymentBatch.update({
      where: { id: params.batchId },
      data: { tellerId: params.newTellerId, status: "ASSIGNED" },
    });

    await tx.auditLog.create({
      data: {
        userId: params.reassignedById,
        action: "PAYMENT_REASSIGNED",
        module: "payment",
        entityId: batch.entityId,
        resourceId: batch.id,
        resourceType: "PaymentBatch",
        afterData: JSON.stringify({
          oldTellerId,
          newTellerId: params.newTellerId,
          reason: params.reason ?? null,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: params.newTellerId,
        type: "ALERT",
        title: "Payment Reassigned To You",
        message: `Invoice ${batch.invoice.invoiceNo} has been reassigned to you by ${params.reassignedByRoleName}.`,
        actionUrl: "/payment/my-tasks",
      },
    });

    if (oldTellerId) {
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

    return { batch: updated, newTeller, oldTellerId };
  });
}

export async function getBatchExportRow(batchId: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: { invoice: { include: { vendor: true, entity: { select: { name: true } } } } },
  });
  if (!batch) throw new PaymentError("Payment batch not found", 404);

  const inv = batch.invoice;
  const v = inv.vendor;

  return {
    invoiceNo: inv.invoiceNo,
    entity: inv.entity.name,
    vendorName: v?.name ?? inv.vendorName,
    bankName: v?.bankName ?? "",
    bankAccountNo: v?.bankAccountNo ?? "",
    bankAccountName: v?.bankAccountName ?? "",
    tin: v?.taxId ?? "",
    subtotal: Number(inv.subtotal).toFixed(2),
    vatAmount: Number(inv.vatAmount).toFixed(2),
    totalAmountWithVat: Number(inv.totalAmount).toFixed(2),
    whtAmount: Number(inv.whtAmount).toFixed(2),
    amountPayable: Number(inv.amountPayable).toFixed(2),
    glAccountCode: inv.glAccountCode,
    description: inv.description ?? "",
  };
}

export async function searchApprovalQueue(params: {
  approverId: string;
  allowedEntityIds: string[] | null;
  tellerName?: string;
  transactionRef?: string;
  invoiceNo?: string;
}) {
  return prisma.paymentTranche.findMany({
    where: {
      status: "SUBMITTED",
      processedById: { not: params.approverId },
      approvals: { none: { approvedById: params.approverId } },
      ...(params.transactionRef
        ? { transactionRef: { contains: params.transactionRef } }
        : {}),
      paymentBatch: {
        ...(params.allowedEntityIds ? { entityId: { in: params.allowedEntityIds } } : {}),
        ...(params.tellerName
          ? { teller: { name: { contains: params.tellerName } } }
          : {}),
        ...(params.invoiceNo
          ? { invoice: { invoiceNo: { contains: params.invoiceNo } } }
          : {}),
      },
    },
    include: {
      paymentBatch: {
        include: {
          invoice: { include: { vendor: { select: { name: true } }, entity: { select: { name: true, code: true } } } },
          teller: { select: { name: true, email: true } },
        },
      },
      approvals: { include: { approvedBy: { select: { name: true } } } },
    },
    orderBy: { submittedAt: "asc" },
  });
}

export interface HistorySearchParams {
  allowedEntityIds: string[] | null;
  entityId?: string;
  invoiceNo?: string;
  vendorName?: string;
  transactionRef?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function searchPaymentHistory(params: HistorySearchParams) {
  const where: any = {
    paymentBatch: {},
  };

  if (params.allowedEntityIds) {
    where.paymentBatch.entityId = { in: params.allowedEntityIds };
  }
  if (params.entityId && params.entityId !== "ALL") {
    where.paymentBatch.entityId = params.entityId;
  }
  if (params.invoiceNo) {
    where.paymentBatch.invoice = { invoiceNo: { contains: params.invoiceNo } };
  }
  if (params.vendorName) {
    where.paymentBatch.invoice = {
      ...(where.paymentBatch.invoice ?? {}),
      OR: [
        { vendorName: { contains: params.vendorName } },
        { vendor: { name: { contains: params.vendorName } } },
      ],
    };
  }
  if (params.transactionRef) {
    where.transactionRef = { contains: params.transactionRef };
  }
  if (params.status) {
    where.status = params.status;
  }
  if (params.dateFrom || params.dateTo) {
    where.paidAt = {};
    if (params.dateFrom) where.paidAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.paidAt.lte = new Date(params.dateTo + "T23:59:59");
  }

  return prisma.paymentTranche.findMany({
    where,
    include: {
      paymentBatch: {
        include: {
          invoice: { include: { vendor: { select: { name: true } }, entity: { select: { name: true, code: true } } } },
          teller: { select: { name: true } },
        },
      },
      approvals: { include: { approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function getEntitiesForFilter(allowedEntityIds: string[] | null) {
  return prisma.entity.findMany({
    where: {
      isActive: true,
      ...(allowedEntityIds ? { id: { in: allowedEntityIds } } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function getVendorsForLookup(allowedEntityIds: string[] | null) {
  return prisma.vendor.findMany({
    where: {
      isActive: true,
      ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}
