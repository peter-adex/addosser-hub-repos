import { prisma } from "@/lib/prisma";
import { getHeadOrSupervisorRoleIds, getSupervisorRoleIds } from "@/lib/payment-access";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { getBaseUrl } from "@/lib/base-url";

function deepLink(notificationId: string, targetPath: string): string {
  const redirect = encodeURIComponent(targetPath);
  return `${getBaseUrl()}/api/notifications/${notificationId}/open?redirect=${redirect}`;
}

interface NotifyPayload {
  userId: string;
  userEmail: string;
  userName: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "APPROVAL" | "ALERT";
  title: string;
  message: string;
  targetPath: string;
  emailSubject: string;
  emailBodyHtml: string;
}

async function dispatch(payload: NotifyPayload) {
  const notification = await prisma.notification.create({
    data: {
      userId:   payload.userId,
      type:     payload.type,
      title:    payload.title,
      message:  payload.message,
      actionUrl: payload.targetPath,
    },
  });

  const link = deepLink(notification.id, payload.targetPath);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: payload.userEmail,
    subject: payload.emailSubject,
    html: buildEmailShell(`
      ${payload.emailBodyHtml}
      <a href="${link}"
         style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;
                border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;
                text-align:center;margin-top:24px">
        Open in Addosser Hub →
      </a>
    `),
  });

  return notification;
}

function buildEmailShell(bodyHtml: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:DM Sans,Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;
              overflow:hidden;border:1px solid #E4E8F0">
    <div style="background:#1B2A8A;padding:28px 40px;text-align:center">
      <h1 style="color:#FFB800;font-size:20px;font-weight:800;margin:0;letter-spacing:0.04em">
        ADDOSSER ENTERPRISE HUB
      </h1>
    </div>
    <div style="padding:36px 40px">${bodyHtml}</div>
  </div>
</body></html>`;
}

function infoTable(rows: [string, string][]): string {
  return `
<div style="background:#F4F6FB;border-radius:12px;padding:20px;margin:16px 0;border:1px solid #E4E8F0">
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    ${rows.map(([label, value]) => `
      <tr>
        <td style="color:#6B7280;padding:5px 0;vertical-align:top">${label}</td>
        <td style="color:#1A1D2E;font-weight:600;text-align:right;padding:5px 0">${value}</td>
      </tr>`).join("")}
  </table>
</div>`;
}

export async function notifyPaymentTeamInvoiceReady(opts: {
  invoiceId: string;
  invoiceNo: string;
  vendorName: string;
  entityName: string;
  amountPayable: number;
  submittedByName: string;
  paymentBatchId: string;
}) {
  const roleIds = await getHeadOrSupervisorRoleIds();

  const invoice = await prisma.invoice.findUnique({
    where: { id: opts.invoiceId },
    select: { entityId: true },
  });
  if (!invoice) return;

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      OR: [
        { entityId: invoice.entityId },
        { entityAccess: { some: { entityId: invoice.entityId } } },
      ],
    },
    select: { id: true, email: true, name: true },
  });

  const targetPath = `/payment/queue/${opts.paymentBatchId}`;
  const formattedAmount = formatNaira(opts.amountPayable);

  for (const u of users) {
    await dispatch({
      userId: u.id,
      userEmail: u.email,
      userName: u.name,
      type: "APPROVAL",
      title: "Invoice ready for payment assignment",
      message: `${opts.invoiceNo} — ${opts.vendorName} (${formattedAmount}) is fully approved and waiting in the payment queue.`,
      targetPath,
      emailSubject: `[Action Required] Invoice ${opts.invoiceNo} ready for payment`,
      emailBodyHtml: `
        <h2 style="font-size:20px;font-weight:800;color:#1B2A8A;margin:0 0 8px">
          Invoice Ready for Payment
        </h2>
        <p style="color:#6B7280;font-size:14px;margin:0 0 4px">Hello ${u.name},</p>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 4px">
          The following fully-approved invoice is awaiting payment assignment in your queue.
        </p>
        ${infoTable([
          ["Invoice No", opts.invoiceNo],
          ["Vendor", opts.vendorName],
          ["Entity", opts.entityName],
          ["Amount Payable", formattedAmount],
          ["Submitted by", opts.submittedByName],
        ])}`,
    });
  }
}

export async function notifyTellerAssigned(opts: {
  tellerId: string;
  tellerEmail: string;
  tellerName: string;
  invoiceNo: string;
  vendorName: string;
  amount: number;
  isSplit: boolean;
  trancheCount: number;
  instructions?: string | null;
  paymentBatchId: string;
}) {
  const targetPath = `/payment/my-tasks/${opts.paymentBatchId}`;
  const splitNote = opts.isSplit
    ? `This is a split payment with <strong>${opts.trancheCount} tranches</strong>.`
    : "This is a single full payment.";

  await dispatch({
    userId: opts.tellerId,
    userEmail: opts.tellerEmail,
    userName: opts.tellerName,
    type: "APPROVAL",
    title: "Payment task assigned to you",
    message: `${opts.invoiceNo} — ${opts.vendorName} (${formatNaira(opts.amount)}) has been assigned to you for processing.`,
    targetPath,
    emailSubject: `[Action Required] Payment assigned — ${opts.invoiceNo}`,
    emailBodyHtml: `
      <h2 style="font-size:20px;font-weight:800;color:#1B2A8A;margin:0 0 8px">
        Payment Task Assigned
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 4px">Hello ${opts.tellerName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 4px">
        A payment task has been assigned to you. ${splitNote}
      </p>
      ${infoTable([
        ["Invoice No", opts.invoiceNo],
        ["Vendor", opts.vendorName],
        ["Total Amount", formatNaira(opts.amount)],
        ["Tranches", opts.isSplit ? String(opts.trancheCount) : "1 (Full payment)"],
        ...(opts.instructions ? [["Instructions", opts.instructions] as [string, string]] : []),
      ])}
      <p style="color:#374151;font-size:13px;line-height:1.6;margin:8px 0 0">
        Please process this payment promptly and upload proof of payment for verification.
      </p>`,
  });
}

export async function notifyEscalationToSubmitter(opts: {
  submitterId: string;
  submitterEmail: string;
  submitterName: string;
  invoiceNo: string;
  vendorName: string;
  entityName: string;
  amountPayable: number;
  escalatedByName: string;
  escalatedByRole: string;
  reason: string;
  invoiceId: string;
}) {
  const targetPath = `/invoice/${opts.invoiceId}`;

  await dispatch({
    userId: opts.submitterId,
    userEmail: opts.submitterEmail,
    userName: opts.submitterName,
    type: "WARNING",
    title: `Invoice ${opts.invoiceNo} escalated — action required`,
    message: `${opts.escalatedByName} escalated invoice ${opts.invoiceNo} back to you. Reason: ${opts.reason.slice(0, 80)}...`,
    targetPath,
    emailSubject: `[Action Required] Invoice ${opts.invoiceNo} Escalated for Correction`,
    emailBodyHtml: `
      <h2 style="font-size:20px;font-weight:800;color:#dc2626;margin:0 0 8px">
        ⚠️ Invoice Escalated — Your Action Required
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 4px">Hello ${opts.submitterName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 4px">
        Your invoice has been escalated by the payment team. Please review the details
        below and take corrective action before the invoice can be processed for payment.
      </p>
      ${infoTable([
        ["Invoice No", opts.invoiceNo],
        ["Vendor", opts.vendorName],
        ["Entity", opts.entityName],
        ["Amount Payable", formatNaira(opts.amountPayable)],
        ["Escalated by", `${opts.escalatedByName} (${opts.escalatedByRole})`],
      ])}
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px;margin:12px 0">
        <p style="color:#991B1B;font-size:14px;font-weight:700;margin:0 0 6px">Reason for Escalation:</p>
        <p style="color:#7F1D1D;font-size:14px;line-height:1.6;margin:0">${opts.reason}</p>
      </div>
      <p style="color:#374151;font-size:13px;line-height:1.6;margin:8px 0 0">
        Please review your invoice, make the necessary corrections, and notify the
        payment team once resolved. The payment queue is on hold for this invoice
        until the escalation is cleared.
      </p>`,
  });
}

export async function notifyVerificationRequired(opts: {
  paymentBatchId: string;
  invoiceNo: string;
  vendorName: string;
  trancheLabel: string;
  trancheAmount: number;
  tellerName: string;
  entityId: string;
}) {
  const roleIds = await getSupervisorRoleIds();

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      OR: [
        { entityId: opts.entityId },
        { entityAccess: { some: { entityId: opts.entityId } } },
      ],
    },
    select: { id: true, email: true, name: true },
  });

  const targetPath = `/payment/verify/${opts.paymentBatchId}`;

  for (const u of users) {
    await dispatch({
      userId: u.id,
      userEmail: u.email,
      userName: u.name,
      type: "APPROVAL",
      title: `Payment verification required — ${opts.invoiceNo}`,
      message: `Teller ${opts.tellerName} has submitted ${opts.trancheLabel} (${formatNaira(opts.trancheAmount)}) for verification.`,
      targetPath,
      emailSubject: `[Action Required] Verify payment — ${opts.invoiceNo}`,
      emailBodyHtml: `
        <h2 style="font-size:20px;font-weight:800;color:#1B2A8A;margin:0 0 8px">
          Payment Verification Required
        </h2>
        <p style="color:#6B7280;font-size:14px;margin:0 0 4px">Hello ${u.name},</p>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 4px">
          A teller has submitted a payment tranche for your verification.
        </p>
        ${infoTable([
          ["Invoice No", opts.invoiceNo],
          ["Vendor", opts.vendorName],
          ["Tranche", opts.trancheLabel],
          ["Amount", formatNaira(opts.trancheAmount)],
          ["Processed by", opts.tellerName],
        ])}
        <p style="color:#374151;font-size:13px;line-height:1.6;margin:8px 0 0">
          Please review the proof of payment and approve or return for correction.
        </p>`,
    });
  }
}

export async function dispatchPaymentReminder(reminderId: string) {
  const reminder = await prisma.paymentReminder.findUniqueOrThrow({
    where: { id: reminderId },
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
      vendor: { select: { name: true } },
      invoice: { select: { id: true, invoiceNo: true } },
    },
  });

  const targetPath = reminder.invoiceId
    ? `/invoice/${reminder.invoiceId}`
    : reminder.vendor
    ? `/vendor/${(reminder as any).vendorId}/account`
    : `/payment/reminders?highlight=${reminder.id}`;

  await dispatch({
    userId: reminder.createdById,
    userEmail: reminder.createdBy.email,
    userName: reminder.createdBy.name,
    type: "ALERT",
    title: `Payment Reminder: ${reminder.title}`,
    message: reminder.notes ?? reminder.title,
    targetPath,
    emailSubject: `Payment Reminder — ${reminder.title}`,
    emailBodyHtml: `
      <h2 style="font-size:20px;font-weight:800;color:#FFB800;margin:0 0 8px">
        🔔 Payment Reminder
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 4px">Hello ${reminder.createdBy.name},</p>
      ${infoTable([
        ["Reminder", reminder.title],
        ...(reminder.amount ? [["Amount", formatNaira(Number(reminder.amount))] as [string, string]] : []),
        ...(reminder.vendor ? [["Vendor", reminder.vendor.name] as [string, string]] : []),
        ...(reminder.invoice ? [["Invoice", reminder.invoice.invoiceNo] as [string, string]] : []),
        ["Due Date", new Date(reminder.reminderDate).toLocaleDateString("en-NG", { dateStyle: "long" })],
      ])}
      ${reminder.notes ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin:8px 0 0">${reminder.notes}</p>` : ""}`,
  });

  const now = new Date();
  let nextSendAt: Date | null = null;
  if (reminder.frequency !== "ONCE") {
    nextSendAt = new Date(reminder.reminderDate);
    if (reminder.frequency === "WEEKLY") nextSendAt.setDate(nextSendAt.getDate() + 7);
    if (reminder.frequency === "MONTHLY") nextSendAt.setMonth(nextSendAt.getMonth() + 1);
    if (reminder.frequency === "QUARTERLY") nextSendAt.setMonth(nextSendAt.getMonth() + 3);
  }

  await prisma.paymentReminder.update({
    where: { id: reminderId },
    data: {
      lastSentAt: now,
      sentCount: { increment: 1 },
      isActive: reminder.frequency !== "ONCE",
      nextSendAt,
    },
  });
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
