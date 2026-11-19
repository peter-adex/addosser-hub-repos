import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/mfa/crypto";
import { verifyTotpCode } from "@/lib/mfa/totp";
import { assertNotLocked, recordFailedAttempt, clearFailedAttempts } from "@/lib/mfa/rate-limit";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ code: z.string().min(6).max(6) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A 6-digit code is required." }, { status: 400 });
  }

  const locked = await assertNotLocked(userId);
  if (locked) {
    return NextResponse.json(
      { error: `Too many attempts. Try again after ${locked.lockedUntil.toISOString()}.` },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true, twoFactorLastUsedStep: true },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json(
      { error: "Two-factor authentication is not enrolled for this account." },
      { status: 400 },
    );
  }

  const secret = decryptSecret(user.twoFactorSecret);
  const { valid, usedStep } = verifyTotpCode(parsed.data.code, secret, user.twoFactorLastUsedStep);

  if (!valid) {
    const { locked: nowLocked, attemptsRemaining } = await recordFailedAttempt(userId);
    await logAudit({
      userId,
      action: "MFA_VERIFICATION_CODE_INVALID",
      module: "auth",
      resourceId: userId,
      resourceType: "User",
      req,
    });
    return NextResponse.json(
      nowLocked
        ? { error: "Too many invalid attempts. Your account is temporarily locked." }
        : { error: "Invalid code.", attemptsRemaining },
      { status: nowLocked ? 429 : 400 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorVerifiedAt: new Date(), twoFactorLastUsedStep: usedStep },
  });
  await clearFailedAttempts(userId);

  await logAudit({
    userId,
    action: "MFA_VERIFIED",
    module: "auth",
    resourceId: userId,
    resourceType: "User",
    req,
  });

  return NextResponse.json({ success: true });
}
