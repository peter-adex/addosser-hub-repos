import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FROM_EMAIL, resend } from "@/lib/resend";
import { addHours } from "date-fns";
import { z } from "zod";
import { getBaseUrl } from "@/lib/base-url";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ success: true });

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || !user.isActive) return NextResponse.json({ success: true });

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const token = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      expiresAt: addHours(new Date(), 1),
    },
  });

  const resetUrl = `${getBaseUrl()}/reset-password/${token.token}`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your Addosser Hub password",
      html: `
          <div style="font-family:DM Sans,Arial,sans-serif;max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #E4E8F0;overflow:hidden">
            <div style="background:#1B2A8A;padding:28px 40px;text-align:center">
              <h1 style="color:#FFB800;font-size:20px;font-weight:800;margin:0">ADDOSSER ENTERPRISE HUB</h1>
            </div>
            <div style="padding:40px">
              <h2 style="font-size:22px;font-weight:800;color:#1A1A2E;margin-top:0">Reset your password</h2>
              <p style="color:#6B7280;font-size:15px;line-height:1.6">Hi ${user.name},<br>We received a request to reset your password. Click the button below to choose a new one.</p>
              <a href="${resetUrl}" style="display:block;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;text-align:center;margin:28px 0">Reset Password →</a>
              <p style="color:#9CA3AF;font-size:12px">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        `,
    });
  } catch (err) {
    console.error("[ForgotPassword] Email send failed:", err);
  }

  return NextResponse.json({ success: true });
}
