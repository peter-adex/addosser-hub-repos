export type DocumentNotificationKind = "reminder" | "critical";

export interface DocumentNotificationData {
  plateNumber: string;
  vehicleDescription: string;
  documentType: string;
  expiryDate: Date;
  daysRemaining: number;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  registerUrl: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function daysPhrase(kind: DocumentNotificationKind, daysRemaining: number): string {
  if (kind === "critical") return plural(Math.abs(daysRemaining), "day");
  if (daysRemaining === 0) return "Expires today";
  return plural(daysRemaining, "day");
}

function row(label: string, value: string, emphasise = false): string {
  return `<tr>
<td style="color:#6B7280;padding:6px 0;font-size:14px;vertical-align:top;width:42%">${esc(label)}</td>
<td style="color:${emphasise ? "#B91C1C" : "#1A1D2E"};font-weight:${emphasise ? 800 : 600};padding:6px 0;font-size:14px;text-align:right">${value}</td>
</tr>`;
}

export function buildDocumentNotificationEmail(
  kind: DocumentNotificationKind,
  data: DocumentNotificationData,
): BuiltEmail {
  const isCritical = kind === "critical";
  const plate = esc(data.plateNumber);
  const docType = esc(data.documentType);
  const expiry = formatDate(data.expiryDate);
  const days = daysPhrase(kind, data.daysRemaining);

  const subject = isCritical
    ? `CRITICAL: Vehicle Document Expired – ${data.plateNumber} – ${data.documentType}`
    : `Vehicle Document Expiry Reminder – ${data.plateNumber} – ${data.documentType}`;

  const assignedUser = data.assignedUserName
    ? esc(data.assignedUserName)
    : "Not assigned";
  const assignedEmail = data.assignedUserEmail
    ? esc(data.assignedUserEmail)
    : "Not available";

  const accent = isCritical ? "#B91C1C" : "#1B2A8A";
  const heading = isCritical
    ? "CRITICAL VEHICLE DOCUMENT EXPIRY"
    : "VEHICLE DOCUMENT EXPIRY REMINDER";

  const intro = isCritical
    ? `A vehicle document has <strong>expired</strong> and has not yet been renewed or updated in the Fleet system.`
    : data.daysRemaining === 0
      ? `A vehicle document <strong>expires today</strong>.`
      : `A vehicle document is due to expire in <strong>${days}</strong>.`;

  const action = isCritical
    ? `This vehicle document has expired and has not yet been renewed or updated in the Fleet system. Please renew it and update the document and its expiry date in the Fleet system as soon as the renewal is completed. Reminders will continue until the new expiry date is recorded.`
    : `Please arrange renewal of this document before it expires, and update the document and its new expiry date in the Fleet system once the renewal is completed.`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:DM Sans,Arial,sans-serif">
<div style="max-width:580px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E4E8F0">
  <div style="background:#1B2A8A;padding:24px 40px;text-align:center">
    <h1 style="color:#FFB800;font-size:18px;font-weight:800;margin:0;letter-spacing:0.04em">ADDOSSER ENTERPRISE HUB</h1>
    <p style="color:#C7CDF0;font-size:12px;margin:4px 0 0">Fleet Management</p>
  </div>
  <div style="background:${accent};padding:12px 40px;text-align:center">
    <p style="color:#ffffff;font-size:13px;font-weight:800;margin:0;letter-spacing:0.05em">${heading}</p>
  </div>
  <div style="padding:32px 40px">
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">${intro}</p>
    <div style="background:#F4F6FB;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #E4E8F0">
      <table style="width:100%;border-collapse:collapse">
        ${row("Vehicle", plate)}
        ${row("Vehicle Description", esc(data.vehicleDescription))}
        ${row("Document Type", docType)}
        ${row("Expiry Date", esc(expiry))}
        ${row(isCritical ? "Days Expired" : "Days Remaining", esc(days), isCritical)}
        ${row("Assigned User", assignedUser)}
        ${row("Assigned User Email", assignedEmail)}
      </table>
    </div>
    <div style="border-left:4px solid ${accent};background:${isCritical ? "#FEF2F2" : "#F4F6FB"};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:28px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:${accent}">Action Required</p>
      <p style="margin:0;font-size:13.5px;line-height:1.6;color:#374151">${esc(action)}</p>
    </div>
    <a href="${esc(data.registerUrl)}" style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center;margin-bottom:24px">Open Vehicle Document Register →</a>
    <hr style="border:none;border-top:1px solid #E4E8F0;margin:24px 0">
    <p style="color:#9CA3AF;font-size:12px;line-height:1.5;margin:0">
      This is an automated notification from the Fleet Management module. You are receiving it because you are the assigned user for this vehicle or a configured Fleet notification recipient. Do not reply to this email.
    </p>
  </div>
</div>
</body></html>`;

  const text = [
    heading,
    "",
    isCritical
      ? "A vehicle document has expired and has not yet been renewed or updated in the Fleet system."
      : data.daysRemaining === 0
        ? "A vehicle document expires today."
        : `A vehicle document is due to expire in ${days}.`,
    "",
    `Vehicle: ${data.plateNumber}`,
    `Vehicle Description: ${data.vehicleDescription}`,
    `Document Type: ${data.documentType}`,
    `Expiry Date: ${expiry}`,
    `${isCritical ? "Days Expired" : "Days Remaining"}: ${days}`,
    `Assigned User: ${data.assignedUserName ?? "Not assigned"}`,
    `Assigned User Email: ${data.assignedUserEmail ?? "Not available"}`,
    "",
    "ACTION REQUIRED",
    action,
    "",
    `Vehicle Document Register: ${data.registerUrl}`,
    "",
    "This is an automated notification from the Fleet Management module.",
  ].join("\n");

  return { subject, html, text };
}
