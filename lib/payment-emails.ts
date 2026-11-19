import { resend, FROM_EMAIL } from "./resend";

async function safeSend(opts: Parameters<typeof resend.emails.send>[0]) {
  try {
    return await resend.emails.send(opts);
  } catch (err) {
    console.error("[Resend] payment email send error:", err);
    return null;
  }
}

function shell(opts: {
  headerEmoji?: string;
  titleColor?: string;
  title: string;
  bodyHtml: string;
}) {
  return `
  <!DOCTYPE html>
  <html><head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#F4F6FB;font-family:DM Sans,Arial,sans-serif">
    <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E8F0">
      <div style="background:#1B2A8A;padding:28px 40px;text-align:center">
        <h1 style="color:#FFB800;font-size:20px;font-weight:800;margin:0;letter-spacing:0.04em">ADDOSSER ENTERPRISE HUB</h1>
      </div>
      <div style="padding:36px 40px">
        <h2 style="font-size:20px;font-weight:800;color:${opts.titleColor ?? "#1A1D2E"};margin:0 0 20px">
          ${opts.headerEmoji ?? ""} ${opts.title}
        </h2>
        ${opts.bodyHtml}
      </div>
    </div>
  </body></html>`;
}

function infoTable(rows: [string, string][]) {
  return `
  <div style="background:#F4F6FB;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #E4E8F0">
    <table style="width:100%;font-size:14px">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="color:#6B7280;padding:4px 0">${label}</td>
          <td style="color:#1A1D2E;font-weight:600;text-align:right">${value}</td>
        </tr>`,
        )
        .join("")}
    </table>
  </div>`;
}

function cta(url: string, label: string) {
  return `
  <a href="${url}" style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center;margin-bottom:8px">
    ${label}
  </a>`;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(n);

export async function sendPaymentAssignedEmail(opts: {
  to: string;
  tellerName: string;
  assignedByName: string;
  invoiceNo: string;
  vendorName: string;
  entityName: string;
  totalAmount: number;
  trancheCount: number;
  instructions?: string;
  actionUrl: string;
}) {
  const body = `
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px">Hello ${opts.tellerName},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 20px">
      ${opts.assignedByName} has assigned you to process payment for invoice
      <strong>${opts.invoiceNo}</strong>${opts.trancheCount > 1 ? ` in ${opts.trancheCount} tranches` : ""}.
    </p>
    ${infoTable([
      ["Vendor", opts.vendorName],
      ["Entity", opts.entityName],
      ["Total Amount", fmt(opts.totalAmount)],
      ["Tranches", String(opts.trancheCount)],
    ])}
    ${
      opts.instructions
        ? `<div style="margin-bottom:24px;padding:14px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;font-size:13px;color:#92400E"><strong>Instructions:</strong> ${opts.instructions}</div>`
        : ""
    }
    ${cta(opts.actionUrl, "Start Processing →")}
  `;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `[Action Required] Payment Assignment — ${opts.invoiceNo}`,
    html: shell({
      headerEmoji: "💳",
      title: "New Payment Assignment",
      bodyHtml: body,
    }),
  });
}

export async function sendPaymentSubmittedForApprovalEmail(opts: {
  to: string;
  approverName: string;
  invoiceNo: string;
  vendorName: string;
  trancheLabel: string;
  amount: number;
  transactionRef?: string | null;
  processedByName: string;
  actionUrl: string;
}) {
  const body = `
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px">Hello ${opts.approverName},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 20px">
      ${opts.processedByName} has processed and submitted a payment for your approval.
    </p>
    ${infoTable([
      ["Invoice", opts.invoiceNo],
      ["Vendor", opts.vendorName],
      ["Tranche", opts.trancheLabel],
      ["Amount", fmt(opts.amount)],
      ...(opts.transactionRef
        ? ([["Transaction Ref", opts.transactionRef]] as [string, string][])
        : []),
    ])}
    ${cta(opts.actionUrl, "Review & Approve →")}
  `;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `[Action Required] Payment Approval — ${opts.invoiceNo} (${opts.trancheLabel})`,
    html: shell({
      headerEmoji: "✅",
      title: "Payment Awaiting Your Approval",
      bodyHtml: body,
    }),
  });
}

export async function sendVendorPaymentEmail(opts: {
  to: string;
  vendorName: string;
  invoiceNo: string;
  entityName: string;
  amountPaid: number;
  transactionRef?: string | null;
  paymentMethod?: string | null;
  isFinalTranche: boolean;
  remainingBalance?: number;
}) {
  const body = `
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px">Dear ${opts.vendorName},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 20px">
      We are pleased to confirm that payment has been processed against invoice
      <strong>${opts.invoiceNo}</strong> by ${opts.entityName}.
    </p>
    ${infoTable([
      ["Amount Paid", fmt(opts.amountPaid)],
      ...(opts.paymentMethod
        ? ([["Payment Method", opts.paymentMethod.replace(/_/g, " ")]] as [
            string,
            string,
          ][])
        : []),
      ...(opts.transactionRef
        ? ([["Transaction Reference", opts.transactionRef]] as [
            string,
            string,
          ][])
        : []),
      [
        "Status",
        opts.isFinalTranche ? "Invoice Fully Paid" : "Partial Payment",
      ],
    ])}
    ${
      !opts.isFinalTranche && opts.remainingBalance !== undefined
        ? `<div style="margin-bottom:24px;padding:14px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;font-size:13px;color:#1E40AF">
            A remaining balance of <strong>${fmt(opts.remainingBalance)}</strong> will be settled in a subsequent payment.
          </div>`
        : ""
    }
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">
      This is an automated confirmation. Please retain it for your records. For any discrepancy,
      contact your account manager at ${opts.entityName}.
    </p>
  `;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Payment Confirmation — Invoice ${opts.invoiceNo}${opts.isFinalTranche ? "" : " (Partial)"}`,
    html: shell({
      headerEmoji: "💰",
      title: opts.isFinalTranche
        ? "Payment Confirmed"
        : "Partial Payment Confirmed",
      titleColor: "#16a34a",
      bodyHtml: body,
    }),
  });
}

export async function sendPaymentRejectedEmail(opts: {
  to: string;
  tellerName: string;
  invoiceNo: string;
  trancheLabel: string;
  rejectedByName: string;
  reason: string;
  actionUrl: string;
}) {
  const body = `
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px">Hello ${opts.tellerName},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 20px">
      ${opts.rejectedByName} has rejected ${opts.trancheLabel} of invoice
      <strong>${opts.invoiceNo}</strong>. Please review and resubmit.
    </p>
    <div style="margin-bottom:24px;padding:14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;font-size:13px;color:#991B1B">
      <strong>Reason:</strong> ${opts.reason}
    </div>
    ${cta(opts.actionUrl, "Review & Resubmit →")}
  `;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Payment Rejected — ${opts.invoiceNo} (${opts.trancheLabel})`,
    html: shell({
      headerEmoji: "❌",
      title: "Payment Rejected",
      titleColor: "#dc2626",
      bodyHtml: body,
    }),
  });
}

export async function sendInvoiceFullyPaidEmail(opts: {
  to: string;
  submitterName: string;
  invoiceNo: string;
  totalAmount: number;
  actionUrl: string;
}) {
  const body = `
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px">Hello ${opts.submitterName},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 20px">
      Invoice <strong>${opts.invoiceNo}</strong> has been fully paid (${fmt(opts.totalAmount)}). The vendor has been notified.
    </p>
    ${cta(opts.actionUrl, "View Invoice →")}
  `;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `✅ Invoice Paid — ${opts.invoiceNo}`,
    html: shell({
      headerEmoji: "✅",
      title: "Invoice Fully Paid",
      titleColor: "#16a34a",
      bodyHtml: body,
    }),
  });
}
