import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import bcrypt                        from "bcryptjs";
import { z }                         from "zod";

const Schema = z.object({
  token:       z.string().min(10),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body   = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { token, newPassword } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!resetToken) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }
  if (new Date() > resetToken.expiresAt) {
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }
  if (resetToken.usedAt) {
    return NextResponse.json({ error: "This reset link has already been used." }, { status: 400 });
  }
  if (!resetToken.user.isActive) {
    return NextResponse.json({ error: "Account is disabled. Contact your administrator." }, { status: 403 });
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data:  { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data:  { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true, message: "Password reset successfully. You can now sign in." });
}
