import { resend, FROM_EMAIL } from "@/lib/resend";
import { getBaseUrl } from "@/lib/base-url";

function base(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:DM Sans,Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E8F0">
    <div style="background:#1B2A8A;padding:28px 40px;text-align:center">
      <h1 style="color:#FFB800;font-size:20px;font-weight:800;margin:0;letter-spacing:0.04em">
        ADDOSSER ENTERPRISE HUB
      </h1>
    </div>
    <div style="padding:36px 40px">${content}</div>
  </div>
</body></html>`;
}

function notifLink(notificationId: string, path: string): string {
  const base = getBaseUrl();
  if (!notificationId) return `${base}${path}`;
  return `${base}/api/notifications/${notificationId}/open?redirect=${encodeURIComponent(path)}`;
}

function naira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function maskAccount(acct?: string | null): string {
  if (!acct) return "—";
  const d = acct.replace(/\s/g, "");
  return d.length <= 4 ? d : `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center;margin-top:28px">${label}</a>`;
}

function infoTable(rows: [string, string][]): string {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr><td style="color:#6B7280;padding:5px 0;font-size:14px">${label}</td>
         <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${value}</td></tr>`
    )
    .join("");
  return `<div style="background:#F4F6FB;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #E4E8F0">
    <table style="width:100%">${trs}</table>
  </div>`;
}

export async function sendEscalationEmailToSubmitter(opts: {
  to: string;
  submitterName: string;
  invoiceNo: string;
  vendorName: string;
  entityName: string;
  escalatedByRole: string;
  reason: string;
  comment?: string;
  amountPayable: number;
  notificationId: string;
  actionUrl: string;
}) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `⚠️ Action Required — Invoice ${opts.invoiceNo} Escalated for Review`,
    html: base(`
      <h2 style="font-size:20px;font-weight:800;color:#d97706;margin:0 0 8px">
        ⚠️ Invoice Escalated — Your Attention Required
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Hello ${opts.submitterName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
        Your invoice has been flagged by the <strong>${opts.escalatedByRole}</strong> before payment processing.
        Please review the details below and take the required action.
      </p>
      ${infoTable([
        ["Invoice No.", opts.invoiceNo],
        ["Vendor", opts.vendorName],
        ["Entity", opts.entityName],
        ["Amount Payable", naira(opts.amountPayable)],
        ["Flagged by", opts.escalatedByRole],
      ])}
      <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:16px;margin-top:4px">
        <p style="margin:0;font-size:14px;color:#92400E"><strong>Reason for Escalation:</strong></p>
        <p style="margin:6px 0 0;font-size:14px;color:#78350F">${opts.reason}</p>
        ${opts.comment ? `<p style="margin:8px 0 0;font-size:13px;color:#92400E"><em>${opts.comment}</em></p>` : ""}
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0 0">
        Click the button below to review your invoice, make any necessary corrections or clarifications,
        and resubmit. The payment team will be notified automatically once you have resolved this.
      </p>
      ${ctaButton(notifLink(opts.notificationId, opts.actionUrl), "Review Invoice →")}
      <hr style="border:none;border-top:1px solid #E4E8F0;margin:24px 0">
      <p style="color:#9CA3AF;font-size:12px;margin:0">
        This escalation was raised by ${opts.entityName}'s payment team. If you believe this is in error,
        please contact your Finance department.
      </p>
    `),
  });
}

export async function sendEscalationResolvedEmail(opts: {
  to: string;
  recipientName: string;
  invoiceNo: string;
  resolveNote: string;
  actionUrl: string;
}) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `✅ Escalation Resolved — Invoice ${opts.invoiceNo} Back in Queue`,
    html: base(`
      <h2 style="font-size:20px;font-weight:800;color:#16a34a;margin:0 0 8px">
        ✅ Escalation Resolved
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Hello ${opts.recipientName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
        The invoice submitter has resolved the escalation you raised for invoice
        <strong>${opts.invoiceNo}</strong>. It has been returned to the payment queue and is ready for assignment.
      </p>
      ${infoTable([["Submitter's Note", opts.resolveNote]])}
      ${ctaButton(opts.actionUrl, "View Payment Queue →")}
    `),
  });
}

export async function sendPaymentReadyEmail(opts: {
  to: string;
  recipientName: string;
  invoiceNo: string;
  vendorName: string;
  amountPayable: number;
  notificationId: string;
  actionUrl: string;
}) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `💳 Invoice Ready for Payment — ${opts.invoiceNo}`,
    html: base(`
      <h2 style="font-size:20px;font-weight:800;color:#1B2A8A;margin:0 0 8px">
        Invoice Ready for Payment Assignment
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Hello ${opts.recipientName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
        A fully approved invoice is waiting in the payment queue and requires a Teller assignment.
      </p>
      ${infoTable([
        ["Invoice No.", opts.invoiceNo],
        ["Vendor", opts.vendorName],
        ["Amount Payable", naira(opts.amountPayable)],
      ])}
      ${ctaButton(notifLink(opts.notificationId, opts.actionUrl), "Assign Payment →")}
      <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">
        If you are not already logged in, clicking the button above will take you to the login page.
        After signing in, you will be redirected automatically to the payment queue.
      </p>
    `),
  });
}

export async function sendTellerAssignmentEmail(opts: {
  to: string;
  tellerName: string;
  invoiceNo: string;
  vendorName: string;
  amountPayable: number;
  isSplit: boolean;
  trancheCount: number;
  notificationId: string;
  actionUrl: string;
}) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `[Action Required] Payment Task Assigned — ${opts.invoiceNo}`,
    html: base(`
      <h2 style="font-size:20px;font-weight:800;color:#1B2A8A;margin:0 0 8px">
        Payment Task Assigned to You
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Hello ${opts.tellerName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
        You have been assigned to process a payment. Please log in and complete this task promptly.
      </p>
      ${infoTable([
        ["Invoice No.", opts.invoiceNo],
        ["Vendor", opts.vendorName],
        ["Total Amount", naira(opts.amountPayable)],
        ["Payment Type", opts.isSplit ? `Split — ${opts.trancheCount} tranches` : "Full payment"],
      ])}
      ${ctaButton(notifLink(opts.notificationId, opts.actionUrl), "Process Payment →")}
      <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">
        Upload your proof of payment after disbursement. Your submission will be sent to the
        Payment Head and Supervisor for verification before the vendor is notified.
      </p>
    `),
  });
}

export async function sendVendorPaymentAdviceEmail(opts: {
  to: string;
  vendorName: string;
  invoiceNo: string;
  entityName: string;
  trancheLabel: string;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  amountPaid: number;
  totalAmountPayable: number;
  remainingBalance: number;
  isFinalPayment: boolean;
  paymentMethod?: string | null;
  transactionRef?: string | null;
  paidAt: Date;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  proofUrls: { name: string; url: string }[];
}) {
  const statusHeading = opts.isFinalPayment
    ? "✅ Payment Completed in Full"
    : "💰 Partial Payment Processed";

  const statusColour = opts.isFinalPayment ? "#16a34a" : "#1B2A8A";

  const proofLinks =
    opts.proofUrls.length > 0
      ? `<div style="margin-top:16px">
          <p style="font-size:13px;color:#374151;font-weight:600;margin:0 0 8px">Proof of Payment:</p>
          ${opts.proofUrls
            .map(
              (p) =>
                `<a href="${p.url}" style="display:block;font-size:13px;color:#1B2A8A;text-decoration:underline;margin-bottom:4px">📎 ${p.name}</a>`
            )
            .join("")}
        </div>`
      : "";

  const balanceRow =
    !opts.isFinalPayment
      ? `<tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Outstanding Balance</td>
           <td style="color:#dc2626;font-weight:700;text-align:right;font-size:14px">${naira(opts.remainingBalance)}</td></tr>`
      : "";

  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: opts.isFinalPayment
      ? `Payment Advice — Invoice ${opts.invoiceNo} (Paid in Full)`
      : `Partial Payment Advice — Invoice ${opts.invoiceNo}`,
    html: base(`
      <h2 style="font-size:20px;font-weight:800;color:${statusColour};margin:0 0 8px">
        ${statusHeading}
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Dear ${opts.vendorName},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
        ${opts.entityName} has processed a payment against your invoice <strong>${opts.invoiceNo}</strong>.
        ${opts.isFinalPayment
          ? "This settles the invoice in full. Thank you for your business."
          : `This is a partial payment. An outstanding balance of <strong>${naira(opts.remainingBalance)}</strong> remains and will be paid subsequently.`}
      </p>
      <div style="background:#F4F6FB;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #E4E8F0">
        <table style="width:100%">
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Invoice No.</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${opts.invoiceNo}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Payment For</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${opts.trancheLabel}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px;border-top:1px solid #E4E8F0;padding-top:10px">Subtotal</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px;border-top:1px solid #E4E8F0;padding-top:10px">${naira(opts.subtotal)}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">VAT (7.5%)</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${naira(opts.vatAmount)}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">WHT (2%) Deducted</td>
              <td style="color:#dc2626;font-weight:600;text-align:right;font-size:14px">-${naira(opts.whtAmount)}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px;font-weight:600">Invoice Total Payable</td>
              <td style="color:#1A1D2E;font-weight:700;text-align:right;font-size:14px">${naira(opts.totalAmountPayable)}</td></tr>
          <tr><td colspan="2" style="padding:4px 0"></td></tr>
          <tr><td style="color:#374151;padding:5px 0;font-size:14px;font-weight:700;border-top:2px solid #1B2A8A;padding-top:10px">Amount Paid (This Payment)</td>
              <td style="color:#16a34a;font-weight:800;text-align:right;font-size:16px;border-top:2px solid #1B2A8A;padding-top:10px">${naira(opts.amountPaid)}</td></tr>
          ${balanceRow}
          <tr><td colspan="2" style="padding:8px 0"></td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Payment Method</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${opts.paymentMethod ?? "Bank Transfer"}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Transaction Reference</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${opts.transactionRef ?? "—"}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Payment Date</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${opts.paidAt.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</td></tr>
          <tr><td style="color:#6B7280;padding:5px 0;font-size:14px">Credited Account</td>
              <td style="color:#1A1D2E;font-weight:600;text-align:right;font-size:14px">${opts.bankAccountName ?? ""} ${maskAccount(opts.bankAccountNo)} ${opts.bankName ? `(${opts.bankName})` : ""}</td></tr>
        </table>
        ${proofLinks}
      </div>
      <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">
        This is an automated payment advice from ${opts.entityName}, a subsidiary of Addosser Microfinance Bank Ltd.
        If you believe the amounts or account details above are incorrect, contact your Addosser account manager
        immediately. Do not reply to this email.
      </p>
    `),
  });
}

export async function sendReminderEmail(opts: {
  to: string;
  recipientName: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  vendorName?: string | null;
  reminderDate: Date;
  notes?: string | null;
  notificationId: string;
  actionUrl: string;
}) {
  const rows: [string, string][] = [
    ["Date", opts.reminderDate.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })],
  ];
  if (opts.amount) rows.push(["Amount", naira(opts.amount)]);
  if (opts.vendorName) rows.push(["Vendor", opts.vendorName]);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `🔔 Payment Reminder: ${opts.title}`,
    html: base(`
      <h2 style="font-size:20px;font-weight:800;color:#1B2A8A;margin:0 0 8px">
        🔔 Payment Reminder
      </h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Hello ${opts.recipientName},</p>
      <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 8px">${opts.title}</p>
      ${opts.description ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">${opts.description}</p>` : ""}
      ${infoTable(rows)}
      ${opts.notes ? `<div style="background:#F4F6FB;border-radius:10px;padding:12px 16px;font-size:13px;color:#374151"><strong>Notes:</strong> ${opts.notes}</div>` : ""}
      ${ctaButton(notifLink(opts.notificationId, opts.actionUrl), "View Details →")}
      <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">
        This is an automated reminder from Addosser Enterprise Hub. To manage your reminders, visit
        the Payment Reminders page.
      </p>
    `),
  });
}
