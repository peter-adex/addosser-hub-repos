import nodemailer, { type Transporter } from "nodemailer";

export interface MailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

export interface SendMailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement;
  attachments?: MailAttachment[];
  replyTo?: string;
}

export interface SendMailResult {
  id: string;
  success: boolean;
}

let _transporter: Transporter | null | undefined;

function isConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (_transporter !== undefined) return _transporter;

  if (!isConfigured()) {
    console.warn(
      "[Mailer] SMTP_HOST/SMTP_USER/SMTP_PASS not fully configured — email sending disabled (dev/sandbox mode).",
    );
    _transporter = null;
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

export const FROM_EMAIL = `${process.env.SMTP_FROM_NAME ?? "Addosser Hub"} <${process.env.SMTP_FROM_EMAIL ?? "noreply@addosser.com"}>`;

export async function verifyMailerConnection(): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log("[Mailer] SMTP connection verified OK.");
    return true;
  } catch (err) {
    console.error("[Mailer] SMTP connection verification failed:", err);
    return false;
  }
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  const transporter = getTransporter();

  let html = opts.html;
  if (opts.react) {
    try {
      const { render } = await import("@react-email/render");
      html = await render(opts.react);
    } catch (err) {
      console.error("[Mailer] Failed to render react email template:", err);
    }
  }

  if (!transporter) {
    console.warn(`[Mailer] Sandbox mode — skipped sending "${opts.subject}" to ${opts.to}`);
    return { id: "dev-no-smtp-config", success: false };
  }

  const mailOptions = {
    from: opts.from ?? FROM_EMAIL,
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html,
    text: opts.text,
    attachments: opts.attachments,
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(
        `[Mailer] Sent "${opts.subject}" to ${opts.to} (messageId: ${info.messageId}, attempt ${attempt})`,
      );
      return { id: info.messageId ?? "sent", success: true };
    } catch (err) {
      lastError = err;
      console.error(
        `[Mailer] Attempt ${attempt}/${MAX_RETRIES + 1} failed sending "${opts.subject}" to ${opts.to}:`,
        err,
      );
      if (attempt <= MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  console.error(`[Mailer] Giving up on "${opts.subject}" to ${opts.to} after ${MAX_RETRIES + 1} attempts.`, lastError);
  return { id: "send-failed", success: false };
}
