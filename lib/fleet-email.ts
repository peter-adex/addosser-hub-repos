import { resend } from "@/lib/resend";
import { getBaseUrl } from "@/lib/base-url";

const FROM = process.env.EMAIL_FROM ?? "Addosser Enterprise Hub <noreply@addosser.ng>";
function APP_URL() {
  return getBaseUrl();
}

export async function sendInviteEmail(params: {
  name: string;
  email: string;
  defaultPassword: string;
  role: string;
}): Promise<void> {
  const { name, email, defaultPassword, role } = params;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f5f8; padding: 24px;">
      <div style="background: #1B3070; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
        <h1 style="color: #F5C800; margin: 0; font-size: 20px; letter-spacing: 0.05em;">ADDOSSER</h1>
        <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">Enterprise Hub</p>
      </div>
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin-top: 0;">Welcome, ${name}!</h2>
        <p style="color: #6b7280;">Your account has been created on the Addosser Enterprise Hub with the role of <strong style="color: #1B3070;">${role}</strong>.</p>
        <p style="color: #6b7280;">Use the credentials below to sign in for the first time:</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; color: #374151;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0; color: #374151;"><strong>Password:</strong> <code style="background: #fff3cd; padding: 2px 6px; border-radius: 4px; font-size: 15px;">${defaultPassword}</code></p>
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; color: #856404; font-size: 13px;">
            ⚠️ <strong>Important:</strong> You will be required to change this password immediately after your first login.
          </p>
        </div>
        <a href="${APP_URL()}/login" style="display: inline-block; background: #1B3070; color: #F5C800; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
          Sign In Now →
        </a>
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">
        © ${new Date().getFullYear()} Addosser Microfinance Bank. Do not reply to this email.
      </p>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Addosser Enterprise Hub Account",
    html,
  });
}

export async function sendPasswordResetEmail(params: {
  name: string;
  email: string;
  resetToken: string;
}): Promise<void> {
  const { name, email, resetToken } = params;
  const resetUrl = `${APP_URL()}/reset-password/${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #1B3070; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
        <h1 style="color: #F5C800; margin: 0; font-size: 20px;">ADDOSSER Enterprise Hub</h1>
      </div>
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827;">Password Reset Request</h2>
        <p style="color: #6b7280;">Hi ${name}, we received a request to reset your password.</p>
        <p style="color: #6b7280;">Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #1B3070; color: #F5C800; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Reset My Password →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          If you did not request a password reset, please ignore this email. Your password will not be changed.
        </p>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset Your Addosser Enterprise Hub Password",
    html,
  });
}

export async function sendAppraisalSubmittedEmail(params: {
  hrName: string;
  hrEmail: string;
  driverName: string;
  period: string;
  supervisorName: string;
  overallScore: number;
  grade: string;
}): Promise<void> {
  const { hrName, hrEmail, driverName, period, supervisorName, overallScore, grade } = params;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #1B3070; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
        <h1 style="color: #F5C800; margin: 0; font-size: 20px;">ADDOSSER Enterprise Hub</h1>
        <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 11px;">Driver Appraisal Notification</p>
      </div>
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827;">Appraisal Submitted for Review</h2>
        <p style="color: #6b7280;">Hi ${hrName},</p>
        <p style="color: #6b7280;">A driver performance appraisal has been submitted and requires your review.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #374151;"><strong>Driver:</strong> ${driverName}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Period:</strong> ${period}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Submitted by:</strong> ${supervisorName}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Overall Score:</strong> ${overallScore.toFixed(1)}% (Grade ${grade})</p>
        </div>
        <a href="${APP_URL()}/fleet/appraisals" style="display: inline-block; background: #1B3070; color: #F5C800; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Review Appraisal →
        </a>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: FROM,
    to: hrEmail,
    subject: `Driver Appraisal: ${driverName} — ${period}`,
    html,
  });
}

export async function sendAppraisalReviewedEmail(params: {
  supervisorName: string;
  supervisorEmail: string;
  driverName: string;
  period: string;
  hrReviewerName: string;
  hrNotes?: string;
}): Promise<void> {
  const { supervisorName, supervisorEmail, driverName, period, hrReviewerName, hrNotes } = params;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #1B3070; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
        <h1 style="color: #F5C800; margin: 0; font-size: 20px;">ADDOSSER Enterprise Hub</h1>
      </div>
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827;">Appraisal Reviewed by HR</h2>
        <p style="color: #6b7280;">Hi ${supervisorName},</p>
        <p style="color: #6b7280;">The appraisal for <strong>${driverName}</strong> (${period}) has been reviewed by <strong>${hrReviewerName}</strong>.</p>
        ${hrNotes ? `<div style="background: #f9fafb; border-left: 4px solid #1B3070; padding: 12px 16px; margin: 16px 0;"><p style="margin: 0; color: #374151;"><em>"${hrNotes}"</em></p></div>` : ""}
        <a href="${APP_URL()}/fleet/appraisals" style="display: inline-block; background: #1B3070; color: #F5C800; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View Appraisal →
        </a>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: FROM,
    to: supervisorEmail,
    subject: `Appraisal Reviewed: ${driverName} — ${period}`,
    html,
  });
}
