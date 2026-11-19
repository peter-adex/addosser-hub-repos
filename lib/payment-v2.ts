import { prisma } from "@/lib/prisma";
import { getUsersWithPaymentPermission, notifyUsers } from "@/lib/payment-extras";
import {
  sendEscalationEmailToSubmitter,
  sendEscalationResolvedEmail,
  sendPaymentReadyEmail,
  sendTellerAssignmentEmail,
  sendVendorPaymentAdviceEmail,
  sendReminderEmail,
} from "@/lib/payment-emails-v2";

export async function escalateInvoice(opts: {
  invoiceId: string;
  escalatedById: string;
  escalatedByRole: string;
  reason: string;
  comment?: string;
}) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: opts.invoiceId },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      vendor: { select: { name: true } },
      entity: { select: { name: true, code: true } },
    },
  });

  const allowedStatuses = ["APPROVED", "PAYMENT_QUEUED", "PAYMENT_ASSIGNED"];
  if (!allowedStatuses.includes(invoice.status)) {
    throw new Error(
      `Cannot escalate invoice in status "${invoice.status}". ` +
        `Only fully approved or queued invoices can be escalated.`,
    );
  }

  const escalation = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentEscalation.create({
      data: {
        invoiceId: opts.invoiceId,
        escalatedById: opts.escalatedById,
        escalatedByRole: opts.escalatedByRole,
        reason: opts.reason,
        comment: opts.comment,
        status: "OPEN",
      },
    });

    await tx.invoice.update({
      where: { id: opts.invoiceId },
      data: { status: "PAYMENT_ESCALATED" },
    });

    await tx.paymentBatch.updateMany({
      where: {
        invoiceId: opts.invoiceId,
        status: { in: ["ASSIGNED"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: `Invoice escalated: ${opts.reason}`,
      },
    });

    return created;
  });

  const notification = await prisma.notification.create({
    data: {
      userId: invoice.submittedBy.id,
      type: "WARNING",
      title: `Invoice ${invoice.invoiceNo} — Escalation Notice`,
      message: `Your invoice has been flagged by ${opts.escalatedByRole} for review. Reason: ${opts.reason}`,
      actionUrl: `/invoice/${invoice.id}`,
    },
  });

  await sendEscalationEmailToSubmitter({
    to: invoice.submittedBy.email,
    submitterName: invoice.submittedBy.name,
    invoiceNo: invoice.invoiceNo,
    vendorName: invoice.vendor?.name ?? invoice.vendorName,
    entityName: invoice.entity.name,
    escalatedByRole: opts.escalatedByRole,
    reason: opts.reason,
    comment: opts.comment,
    amountPayable: Number(invoice.amountPayable),
    notificationId: notification.id,
    actionUrl: `/invoice/${invoice.id}`,
  });

  await prisma.auditLog.create({
    data: {
      userId: opts.escalatedById,
      action: "INVOICE_ESCALATED",
      module: "payment",
      resourceId: opts.invoiceId,
      resourceType: "Invoice",
      afterData: JSON.stringify({ reason: opts.reason, comment: opts.comment }),
    },
  });

  return escalation;
}

export async function resolveEscalation(opts: {
  escalationId: string;
  resolvedById: string;
  resolveNote: string;
}) {
  const escalation = await prisma.paymentEscalation.findUniqueOrThrow({
    where: { id: opts.escalationId },
    include: {
      invoice: {
        include: {
          submittedBy: { select: { name: true } },
          entity: { select: { id: true, name: true } },
        },
      },
      escalatedBy: { select: { name: true, email: true } },
    },
  });

  if (escalation.status !== "OPEN") {
    throw new Error("This escalation has already been resolved or closed.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentEscalation.update({
      where: { id: opts.escalationId },
      data: {
        status: "RESOLVED",
        resolvedById: opts.resolvedById,
        resolvedNote: opts.resolveNote,
        resolvedAt: new Date(),
      },
    });

    await tx.invoice.update({
      where: { id: escalation.invoiceId },
      data: { status: "PAYMENT_QUEUED" },
    });
  });

  const heads = await getUsersWithPaymentPermission(
    escalation.invoice.entity.id,
    "canCreate",
  );
  const supervisors = await getUsersWithPaymentPermission(
    escalation.invoice.entity.id,
    "canApprove",
  );
  const recipients = [...heads, ...supervisors];

  await notifyUsers(recipients, {
    title: `Escalation Resolved — ${escalation.invoice.invoiceNo}`,
    message: `${escalation.invoice.submittedBy.name} has addressed the escalation. Invoice is back in the payment queue.`,
    actionUrl: `/payment/queue`,
    type: "INFO",
  });

  await sendEscalationResolvedEmail({
    to: escalation.escalatedBy.email,
    recipientName: escalation.escalatedBy.name,
    invoiceNo: escalation.invoice.invoiceNo,
    resolveNote: opts.resolveNote,
    actionUrl: `/payment/queue`,
  });

  return { success: true };
}

export async function notifyPaymentTeamOfReadyInvoice(opts: {
  invoiceId: string;
  entityId: string;
  invoiceNo: string;
  vendorName: string;
  amountPayable: number;
  actorId: string;
}) {
  const heads = await getUsersWithPaymentPermission(opts.entityId, "canCreate");
  const supervisors = await getUsersWithPaymentPermission(
    opts.entityId,
    "canApprove",
  );

  const uniqueRecipients = [
    ...new Map([...heads, ...supervisors].map((u) => [u.id, u])).values(),
  ];

  for (const user of uniqueRecipients) {
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: "APPROVAL",
        title: `Invoice Ready for Payment — ${opts.invoiceNo}`,
        message: `${opts.vendorName} invoice of ₦${opts.amountPayable.toLocaleString("en-NG")} is fully approved and awaiting payment assignment.`,
        actionUrl: `/payment/queue`,
      },
    });

    await sendPaymentReadyEmail({
      to: user.email,
      recipientName: user.name,
      invoiceNo: opts.invoiceNo,
      vendorName: opts.vendorName,
      amountPayable: opts.amountPayable,
      notificationId: notification.id,
      actionUrl: `/payment/queue`,
    });
  }
}

export async function notifyTellerOfAssignment(opts: {
  tellerId: string;
  tellerEmail: string;
  tellerName: string;
  invoiceNo: string;
  vendorName: string;
  amountPayable: number;
  paymentBatchId: string;
  isSplit: boolean;
  trancheCount: number;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: opts.tellerId,
      type: "APPROVAL",
      title: `Payment Task Assigned — ${opts.invoiceNo}`,
      message: opts.isSplit
        ? `You have been assigned to process ${opts.trancheCount} payment tranches for ${opts.vendorName}. Total: ₦${opts.amountPayable.toLocaleString("en-NG")}.`
        : `You have been assigned to process payment of ₦${opts.amountPayable.toLocaleString("en-NG")} to ${opts.vendorName}.`,
      actionUrl: `/payment/my-tasks/${opts.paymentBatchId}`,
    },
  });

  await sendTellerAssignmentEmail({
    to: opts.tellerEmail,
    tellerName: opts.tellerName,
    invoiceNo: opts.invoiceNo,
    vendorName: opts.vendorName,
    amountPayable: opts.amountPayable,
    isSplit: opts.isSplit,
    trancheCount: opts.trancheCount,
    notificationId: notification.id,
    actionUrl: `/payment/my-tasks/${opts.paymentBatchId}`,
  });
}

async function nextJournalReference(entityId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JRN-${year}-`;
  const last = await prisma.paymentJournalEntry.findFirst({
    where: { entryRef: { startsWith: prefix } },
    orderBy: { entryRef: "desc" },
    select: { entryRef: true },
  });
  const seq = last ? parseInt(last.entryRef.replace(prefix, ""), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export async function postTrancheJournalEntry(opts: {
  trancheId: string;
  postedById: string;
}) {
  const tranche = await prisma.paymentTranche.findUniqueOrThrow({
    where: { id: opts.trancheId },
    include: {
      paymentBatch: {
        include: {
          invoice: {
            include: {
              entity: true,
              vendor: true,
            },
          },
        },
      },
    },
  });

  const invoice = tranche.paymentBatch.invoice;
  const amount = Number(tranche.plannedAmount);
  const entityId = invoice.entityId;

  const vatAmount = Number(invoice.vatAmount);
  const whtAmount = Number(invoice.whtAmount);

  const reference = await nextJournalReference(entityId);

  await prisma.$transaction(async (tx) => {
    const entry = await tx.paymentJournalEntry.create({
      data: {
        entityId,
        paymentBatchId: tranche.paymentBatch.id,
        paymentTrancheId: tranche.id,
        invoiceId: invoice.id,
        entryRef: reference,
        entryDate: tranche.paidAt ?? new Date(),
        description: `Payment to ${invoice.vendor?.name ?? invoice.vendorName} — Invoice ${invoice.invoiceNo} (${tranche.label ?? `Tranche ${tranche.trancheNumber}`})`,
        invoiceNo: invoice.invoiceNo,
        vendorName: invoice.vendor?.name ?? invoice.vendorName,
        debitGLCode: "2001",
        debitGLName: "Accounts Payable",
        creditGLCode: "1001",
        creditGLName: "Bank Account",
        grossAmount: amount,
        vatAmount,
        whtAmount,
        netAmount: amount,
        createdById: opts.postedById,
      },
    });

    const lastEntry = await tx.vendorLedger.findFirst({
      where: { vendorId: invoice.vendorId ?? "", entityId },
      orderBy: { createdAt: "desc" },
      select: { runningBalance: true },
    });

    const currentBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;

    if (invoice.vendorId) {
      await tx.vendorLedger.create({
        data: {
          vendorId: invoice.vendorId,
          entityId,
          entryType: "PAYMENT_MADE",
          invoiceId: invoice.id,
          paymentTrancheId: tranche.id,
          description: `Payment — ${invoice.invoiceNo} (${tranche.label ?? `Tranche ${tranche.trancheNumber}`})`,
          creditAmount: amount,
          runningBalance: currentBalance - amount,
          entryDate: tranche.paidAt ?? new Date(),
          reference,
        },
      });
    }

    return entry;
  });

  return { reference };
}

export async function postInvoiceRaisedToVendorLedger(opts: {
  invoiceId: string;
}) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: opts.invoiceId },
    include: { vendor: true, entity: true },
  });

  if (!invoice.vendorId) return;

  const lastEntry = await prisma.vendorLedger.findFirst({
    where: { vendorId: invoice.vendorId, entityId: invoice.entityId },
    orderBy: { createdAt: "desc" },
    select: { runningBalance: true },
  });

  const currentBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
  const debitAmount = Number(invoice.amountPayable);

  await prisma.vendorLedger.create({
    data: {
      vendorId: invoice.vendorId,
      entityId: invoice.entityId,
      entryType: "INVOICE_RAISED",
      invoiceId: invoice.id,
      description: `Invoice raised — ${invoice.invoiceNo}`,
      debitAmount,
      runningBalance: currentBalance + debitAmount,
      entryDate: new Date(),
      reference: invoice.invoiceNo,
    },
  });
}

export async function sendPaymentAdvice(opts: {
  trancheId: string;
  isFinalPayment: boolean;
}) {
  const tranche = await prisma.paymentTranche.findUniqueOrThrow({
    where: { id: opts.trancheId },
    include: {
      proofs: true,
      paymentBatch: {
        include: {
          invoice: {
            include: {
              vendor: true,
              entity: true,
              lineItems: true,
            },
          },
        },
      },
    },
  });

  const invoice = tranche.paymentBatch.invoice;
  const vendor = invoice.vendor;

  if (!vendor?.email) return;

  const totalPaid = await prisma.paymentTranche.aggregate({
    where: {
      paymentBatchId: tranche.paymentBatchId,
      status: "PAID",
    },
    _sum: { plannedAmount: true },
  });

  const paidSoFar = Number(totalPaid._sum.plannedAmount ?? 0);
  const totalPayable = Number(invoice.amountPayable);
  const remainingBalance = totalPayable - paidSoFar;

  await sendVendorPaymentAdviceEmail({
    to: vendor.email,
    vendorName: vendor.name,
    invoiceNo: invoice.invoiceNo,
    entityName: invoice.entity.name,
    trancheLabel: tranche.label ?? `Tranche ${tranche.trancheNumber}`,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    whtAmount: Number(invoice.whtAmount),
    amountPaid: Number(tranche.plannedAmount),
    totalAmountPayable: totalPayable,
    remainingBalance,
    isFinalPayment: opts.isFinalPayment,
    paymentMethod: tranche.paymentMethod,
    transactionRef: tranche.transactionRef,
    paidAt: tranche.paidAt ?? new Date(),
    bankAccountNo: vendor.bankAccountNo,
    bankAccountName: vendor.bankAccountName,
    bankName: vendor.bankName,
    proofUrls: tranche.proofs.map((p) => ({
      name: p.fileName,
      url: p.fileUrl,
    })),
  });
}

export async function uploadPaymentProof(opts: {
  trancheId: string;
  fileName: string;
  fileType: string;
  fileBuffer: Buffer;
  fileSize: number;
  uploadedById: string;
  uploadedByRole?: string;
}): Promise<{ fileUrl: string; proofId: string }> {
  const { v2: cloudinary } = await import("cloudinary");

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const uploadResult = await new Promise<{ secure_url: string }>(
    (resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: `addosser/payment-proofs/${opts.trancheId}`,
          public_id: opts.fileName.replace(/\.[^.]+$/, ""),
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result)
            return reject(error ?? new Error("Upload failed"));
          resolve(result);
        },
      );
      uploadStream.end(opts.fileBuffer);
    },
  );

  const proof = await prisma.paymentProof.create({
    data: {
      paymentTrancheId: opts.trancheId,
      fileName: opts.fileName,
      fileType: opts.fileType,
      fileUrl: uploadResult.secure_url,
      fileSize: opts.fileSize,
      uploadedById: opts.uploadedById,
      uploadedByRole: opts.uploadedByRole,
    },
  });

  return { fileUrl: uploadResult.secure_url, proofId: proof.id };
}

export function assertWholeNumber(value: number, fieldName: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(
      `${fieldName} must be a whole number — decimal values are not allowed in payment amounts. ` +
        `Received: ${value}. Round to the nearest whole number.`,
    );
  }
  if (value <= 0) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }
}

export function computeTrancheFromPercentage(opts: {
  totalAmountPayable: number;
  percentageWhole: number;
}): { trancheAmount: number; balance: number } {
  assertWholeNumber(opts.percentageWhole, "Percentage");
  if (opts.percentageWhole <= 0 || opts.percentageWhole > 100) {
    throw new Error("Percentage must be between 1 and 100.");
  }

  const trancheAmount = Math.trunc(
    (opts.totalAmountPayable * opts.percentageWhole) / 100,
  );
  const balance = opts.totalAmountPayable - trancheAmount;

  return { trancheAmount, balance };
}

export async function createPaymentReminder(opts: {
  entityId: string;
  createdById: string;
  title: string;
  notes?: string;
  amount?: number;
  vendorId?: string;
  reminderDate: Date;
  frequency: "ONCE" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  invoiceId?: string;
}) {
  if (opts.amount !== undefined) {
    assertWholeNumber(opts.amount, "Reminder amount");
  }

  return prisma.paymentReminder.create({
    data: {
      entityId: opts.entityId,
      createdById: opts.createdById,
      title: opts.title,
      notes: opts.notes,
      amount: opts.amount,
      vendorId: opts.vendorId,
      invoiceId: opts.invoiceId,
      reminderDate: opts.reminderDate,
      frequency: opts.frequency,
      nextSendAt: opts.reminderDate,
      isActive: true,
    },
  });
}

export function parseAdditionalEmails(raw: string | null | undefined): {
  valid: string[];
  invalid: string[];
} {
  if (!raw?.trim()) return { valid: [], invalid: [] };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parts = raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const valid = [...new Set(parts.filter((e) => emailRe.test(e)))];
  const invalid = parts.filter((e) => !emailRe.test(e));
  return { valid, invalid };
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(worker));
    results.push(...batchResults);
  }
  return results;
}

const MAX_CONSECUTIVE_FAILURES = 5;

const REMINDER_BATCH_SIZE = 5;

export async function processDueReminders() {
  const now = new Date();

  const due = await prisma.paymentReminder.findMany({
    where: {
      isActive: true,
      nextSendAt: { lte: now },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      vendor: { select: { name: true } },
    },
  });

  console.log(`[processDueReminders] Found ${due.length} due reminder(s) at ${now.toISOString()}`);

  let sent = 0;
  let failed = 0;

  const results = await processInBatches(due, REMINDER_BATCH_SIZE, async (reminder: (typeof due)[number]) => {
    const actionUrl = reminder.invoiceId
      ? `/invoice/${reminder.invoiceId}`
      : `/payment/reminders?highlight=${reminder.id}`;

    type Recipient = { email: string; name: string; userId: string | null };
    const recipients: Recipient[] = [];

    if (reminder.createdBy.email) {
      recipients.push({
        email: reminder.createdBy.email,
        name: reminder.createdBy.name,
        userId: reminder.createdById,
      });
    } else {
      console.warn(
        `[processDueReminders] Reminder ${reminder.id}: owner ${reminder.createdById} has no email address — skipping them, will still try additionalEmails if any.`,
      );
    }

    const { valid: additionalEmails } = parseAdditionalEmails(reminder.additionalEmails);
    if (additionalEmails.length) {
      const matchedUsers = await prisma.user.findMany({
        where: { email: { in: additionalEmails } },
        select: { id: true, name: true, email: true },
      });
      const matchedByEmail = new Map(matchedUsers.map((u) => [u.email.toLowerCase(), u]));

      for (const email of additionalEmails) {
        if (email.toLowerCase() === reminder.createdBy.email?.toLowerCase()) continue;
        const match = matchedByEmail.get(email.toLowerCase());
        recipients.push({
          email,
          name: match?.name ?? email,
          userId: match?.id ?? null,
        });
      }
    }

    if (recipients.length === 0) {
      const reason = "No valid recipients — owner has no email and no valid additionalEmails configured";
      console.error(`[processDueReminders] Reminder ${reminder.id}: ${reason}`);
      await prisma.paymentReminder.update({
        where: { id: reminder.id },
        data: {
          failureCount: { increment: 1 },
          lastFailureReason: reason,
          lastFailureAt: now,
        },
      });
      return { ok: false as const };
    }

    const sendResults = await Promise.allSettled(
      recipients.map(async (r) => {
        let notificationId = "";
        if (r.userId) {
          const notif = await prisma.notification.create({
            data: {
              userId: r.userId,
              type: "INFO",
              title: reminder.title,
              message: reminder.notes ?? `Payment reminder: ${reminder.title}`,
              actionUrl,
            },
          });
          notificationId = notif.id;
        }

        try {
          const result = await sendReminderEmail({
            to: r.email,
            recipientName: r.name,
            title: reminder.title,
            description: reminder.notes,
            amount: reminder.amount ? Number(reminder.amount) : null,
            vendorName: reminder.vendor?.name,
            reminderDate: reminder.reminderDate,
            notes: reminder.notes,
            notificationId,
            actionUrl,
          });
          if (!result?.success) throw new Error(`Send returned success=false for ${r.email}`);
          return result;
        } catch (err) {
          if (notificationId) {
            await prisma.notification.delete({ where: { id: notificationId } }).catch(() => {});
          }
          throw err;
        }
      }),
    );

    const succeededRecipients = recipients.filter((_, i) => sendResults[i].status === "fulfilled");
    const failedRecipients = recipients.filter((_, i) => sendResults[i].status === "rejected");

    if (succeededRecipients.length === 0) {
      const firstError =
        sendResults.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      const reason = firstError?.reason?.message ?? "All recipient sends failed";
      console.error(`[processDueReminders] Reminder ${reminder.id}: ${reason}`);

      const newFailureCount = reminder.failureCount + 1;
      const shouldDeactivate = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

      await prisma.$transaction(async (tx) => {
        await tx.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            failureCount: { increment: 1 },
            lastFailureReason: reason,
            lastFailureAt: now,
            ...(shouldDeactivate ? { isActive: false } : {}),
          },
        });

        if (shouldDeactivate) {
          await tx.notification.create({
            data: {
              userId: reminder.createdById,
              type: "WARNING",
              title: `Reminder disabled after repeated failures — ${reminder.title}`,
              message: `"${reminder.title}" failed to send ${newFailureCount} times in a row (${reason}) and has been automatically deactivated. Edit and re-enable it on the Reminders page once fixed.`,
              actionUrl: `/payment/reminders?highlight=${reminder.id}`,
            },
          });
        }
      });

      return { ok: false as const };
    }

    if (failedRecipients.length > 0) {
      console.warn(
        `[processDueReminders] Reminder ${reminder.id}: ${failedRecipients.length}/${recipients.length} recipient(s) failed — ${failedRecipients.map((r) => r.email).join(", ")}`,
      );
    }

    let nextSendAt: Date | null = null;
    let isActive = true;

    if (reminder.frequency === "ONCE") {
      isActive = false;
    } else {
      nextSendAt = new Date(reminder.nextSendAt ?? now);
      let guard = 0;
      do {
        if (reminder.frequency === "WEEKLY") {
          nextSendAt.setDate(nextSendAt.getDate() + 7);
        } else if (reminder.frequency === "MONTHLY") {
          nextSendAt.setMonth(nextSendAt.getMonth() + 1);
        } else if (reminder.frequency === "QUARTERLY") {
          nextSendAt.setMonth(nextSendAt.getMonth() + 3);
        }
        guard++;
      } while (nextSendAt <= now && guard < 60);
    }

    await prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: {
        lastSentAt: now,
        nextSendAt,
        isActive,
        sentCount: { increment: 1 },
        failureCount: 0,
        lastFailureReason: null,
      },
    });

    console.log(
      `[processDueReminders] Sent reminder ${reminder.id} ("${reminder.title}") to ${succeededRecipients.map((r) => r.email).join(", ")}. ` +
        (isActive ? `Next send: ${nextSendAt?.toISOString()}` : "One-off — deactivated."),
    );

    return { ok: true as const };
  });

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) sent++;
    else failed++;
  }

  console.log(`[processDueReminders] Done. Processed ${due.length}, sent ${sent}, failed ${failed}.`);
  return { processed: due.length, sent, failed };
}
