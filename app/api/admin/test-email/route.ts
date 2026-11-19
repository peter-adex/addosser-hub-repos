import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyMailerConnection, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!configured) {
    return NextResponse.json(
      {
        success: false,
        stage: "config",
        message:
          "SMTP is not configured — SMTP_HOST, SMTP_USER and SMTP_PASS must all be set in your environment.",
      },
      { status: 200 },
    );
  }

  const connectionOk = await verifyMailerConnection();
  if (!connectionOk) {
    return NextResponse.json(
      {
        success: false,
        stage: "connection",
        message:
          "Could not connect/authenticate to the SMTP server. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASS, and check the server logs for the detailed SMTP error.",
      },
      { status: 200 },
    );
  }

  const result = await sendMail({
    to: user.email,
    subject: "Addosser Enterprise Hub — SMTP Test Email",
    html: `
      <div style="font-family:DM Sans,Arial,sans-serif;max-width:480px;margin:20px auto;padding:24px;border:1px solid #E4E8F0;border-radius:16px">
        <h2 style="color:#1B2A8A;margin-top:0">✅ SMTP is working</h2>
        <p style="color:#374151;font-size:14px">
          This is a test email sent from the Addosser Enterprise Hub admin panel to confirm
          your SMTP configuration is set up correctly and connected.
        </p>
        <p style="color:#9CA3AF;font-size:12px">Sent at ${new Date().toISOString()} by ${user.name} (${user.email}).</p>
      </div>
    `,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        stage: "send",
        message:
          "Connected to the SMTP server, but the message was rejected while sending. Check the server logs for the exact SMTP error (e.g. sender not authorized, recipient rejected).",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Test email sent successfully to ${user.email}. Check your inbox (and spam folder) to confirm delivery.`,
    messageId: result.id,
  });
}
