import { prisma } from "./prisma";

export async function getPaymentQueueFixed(allowedEntityIds: string[] | null) {
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

