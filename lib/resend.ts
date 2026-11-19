<<<<<<< HEAD
import { sendMail, FROM_EMAIL as MAILER_FROM_EMAIL } from "./mailer";
import { getBaseUrl } from "./base-url";

export const FROM_EMAIL = MAILER_FROM_EMAIL;

export const resend = {
  emails: {
    send: async (opts: {
      from?: string;
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject: string;
      html?: string;
      text?: string;
      react?: React.ReactElement;
      attachments?: { filename: string; content?: string | Buffer; path?: string }[];
    }) => {
      const result = await sendMail(opts);
      return { id: result.id, success: result.success };
    },
  },
};

async function safeSend(opts: Parameters<typeof sendMail>[0]) {
  const result = await sendMail(opts);
  return result.success ? { id: result.id } : null;
}

function notifDeepLink(notificationId: string, targetPath: string): string {
  const base = getBaseUrl();
  return `${base}/api/notifications/${notificationId}/open?redirect=${encodeURIComponent(targetPath)}`;
}
=======
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export const FROM_EMAIL = `${process.env.RESEND_FROM_NAME ?? "Addosser Hub"} <${process.env.RESEND_FROM_EMAIL ?? "noreply@addosser.com"}>`;
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

export async function sendInvitationEmail(opts: {
  to: string;
  name: string;
  inviterName: string;
  role: string;
  entity: string;
  inviteUrl: string;
}) {
  const { InvitationEmail } = await import("../emails/InvitationEmail");
<<<<<<< HEAD
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: "You've been invited to Addosser Enterprise Hub",
=======
  return resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `You've been invited to Addosser Enterprise Hub`,
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    react: InvitationEmail(opts),
  });
}

export async function sendBudgetApprovalEmail(opts: {
  to: string;
  name: string;
  action: "APPROVED" | "REJECTED";
  glName: string;
  entity: string;
  year: number;
  comment?: string;
}) {
  const { BudgetApprovalEmail } = await import("../emails/BudgetApprovalEmail");
<<<<<<< HEAD
  return safeSend({
=======
  return resend.emails.send({
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Budget ${opts.action === "APPROVED" ? "Approved ✅" : "Rejected ❌"} — ${opts.glName}`,
    react: BudgetApprovalEmail(opts),
  });
}
<<<<<<< HEAD
export async function sendApprovalRequestEmail(opts: {
  to: string;
  approverName: string;
  stepNumber: number;
  totalSteps: number;
  resourceType: string;
  resourceName: string;
  submittedBy: string;
  entityName: string;
  actionUrl: string;
}) {
  const {
    actionUrl,
    approverName,
    resourceType,
    resourceName,
    submittedBy,
    entityName,
    stepNumber,
    totalSteps,
  } = opts;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `[Action Required] ${resourceType} Approval — ${resourceName} (Step ${stepNumber}/${totalSteps})`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:DM Sans,Arial,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E8F0">
<!-- Header -->
<div style="background:#1B2A8A;padding:28px 40px;text-align:center">
<h1 style="color:#FFB800;font-size:20px;font-weight:800;margin:0;letter-spacing:0.04em">
ADDOSSER ENTERPRISE HUB
</h1>
</div>
<!-- Body -->
<div style="padding:36px 40px">
<h2 style="font-size:20px;font-weight:800;color:#1A1D2E;margin:0 0 6px">
Approval Required — Step ${stepNumber} of ${totalSteps}
</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 24px">Hello ${approverName},</p>
<div style="background:#F4F6FB;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #E4E8F0">
<table style="width:100%;font-size:14px">
<tr><td style="color:#6B7280;padding:4px 0">Type</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${resourceType}</td></tr>
<tr><td style="color:#6B7280;padding:4px 0">Reference</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${resourceName}</td></tr>
<tr><td style="color:#6B7280;padding:4px 0">Submitted by</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${submittedBy}</td></tr>
<tr><td style="color:#6B7280;padding:4px 0">Entity</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${entityName}</td></tr>
</table>
</div>
<p style="color:#6B7280;font-size:14px;margin-bottom:28px">
This ${resourceType.toLowerCase()} requires your approval. Click the button below to review and take action.
The page will open directly to the approval form, and clicking the link will automatically mark your notification as read.
</p>
<a href="${actionUrl}" style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center;margin-bottom:24px">
Review &amp; Approve →
</a>
<hr style="border:none;border-top:1px solid #E4E8F0;margin:24px 0">
<p style="color:#9CA3AF;font-size:12px;margin:0">
You are receiving this because your role requires approval at step ${stepNumber}.<br>
If you did not expect this, please contact your system administrator.
</p>
</div>
</div>
</body></html>`,
  });
}

export async function sendApprovalResultEmail(opts: {
  to: string;
  submitterName: string;
  action: "APPROVED" | "REJECTED" | "FULLY_APPROVED";
  resourceType: string;
  resourceName: string;
  approverName: string;
  stepNumber: number;
  totalSteps: number;
  comment?: string;
  actionUrl: string;
}) {
  const isFullyApproved = opts.action === "FULLY_APPROVED";
  const isRejected = opts.action === "REJECTED";
  const emoji = isFullyApproved ? "✅" : isRejected ? "❌" : "⏳";
  const statusText = isFullyApproved
    ? "Fully Approved"
    : isRejected
      ? "Rejected"
      : `Step ${opts.stepNumber} Approved`;
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `${emoji} ${opts.resourceType} ${statusText} — ${opts.resourceName}`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:DM Sans,Arial,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E8F0">
<div style="background:#1B2A8A;padding:28px 40px;text-align:center">
<h1 style="color:#FFB800;font-size:20px;font-weight:800;margin:0">ADDOSSER ENTERPRISE HUB</h1>
</div>
<div style="padding:36px 40px">
<h2 style="font-size:20px;font-weight:800;color:${isRejected ? "#dc2626" : isFullyApproved ? "#16a34a" : "#1B2A8A"};margin:0 0 20px">
${emoji} ${opts.resourceType} ${statusText}
</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 20px">Hello ${opts.submitterName},</p>
<div style="background:#F4F6FB;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #E4E8F0">
<table style="width:100%;font-size:14px">
<tr><td style="color:#6B7280;padding:4px 0">Reference</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${opts.resourceName}</td></tr>
<tr><td style="color:#6B7280;padding:4px 0">Actioned by</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${opts.approverName}</td></tr>
<tr><td style="color:#6B7280;padding:4px 0">Step</td>
<td style="color:#1A1D2E;font-weight:600;text-align:right">${opts.stepNumber} of ${opts.totalSteps}</td></tr>
</table>
${opts.comment ? `<div style="margin-top:12px;padding:10px;background:#fff;border-radius:8px;font-size:13px;color:#374151"><strong>Comment:</strong> ${opts.comment}</div>` : ""}
</div>
<a href="${opts.actionUrl}" style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center;margin-bottom:24px">
View ${opts.resourceType} →
</a>
</div>
</div>
</body></html>`,
  });
}

export async function sendInvoiceRecallEmail(opts: {
  to: string;
  approverName: string;
  invoiceNo: string;
  recalledBy: string;
  actionUrl: string;
}) {
  return safeSend({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Invoice Recalled — ${opts.invoiceNo}`,
    html: `
<div style="font-family:DM Sans,Arial,sans-serif;max-width:560px;margin:40px auto">
<p>Hello ${opts.approverName},</p>
<p>Invoice <strong>${opts.invoiceNo}</strong> has been recalled by <strong>${opts.recalledBy}</strong> and returned to Draft status. No action is required from you at this time.</p>
<a href="${opts.actionUrl}" style="display:inline-block;background:#FFB800;color:#1B2A8A;padding:12px 24px;border-radius:10px;font-weight:bold;text-decoration:none">View Invoice</a>
</div>`,
  });
}
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
