import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redeemRecoveryCode } from "@/lib/mfa/recovery-codes";
import { assertNotLocked, recordFailedAttempt, clearFailedAttempts } from "@/lib/mfa/rate-limit";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ code: z.string().min(8).max(12) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A recovery code is required." }, { status: 400 });
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
    select: { twoFactorEnabled: true },
  });
  if (!user?.twoFactorEnabled) {
    return NextResponse.json(
      { error: "Two-factor authentication is not enrolled for this account." },
      { status: 400 },
    );
  }

  const redeemed = await redeemRecoveryCode(userId, parsed.data.code);
  if (!redeemed) {
    const { locked: nowLocked } = await recordFailedAttempt(userId);
    await logAudit({
      userId,
      action: "MFA_RECOVERY_CODE_INVALID",
      module: "auth",
      resourceId: userId,
      resourceType: "User",
      req,
    });
    return NextResponse.json(
      { error: nowLocked ? "Too many invalid attempts. Your account is temporarily locked." : "Invalid or already-used recovery code." },
      { status: nowLocked ? 429 : 400 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorVerifiedAt: new Date() },
  });
  await clearFailedAttempts(userId);

  await logAudit({
    userId,
    action: "MFA_RECOVERY_CODE_USED",
    module: "auth",
    resourceId: userId,
    resourceType: "User",
    req,
  });

  return NextResponse.json({ success: true });
}
