import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function assertNotLocked(userId: string): Promise<{ lockedUntil: Date } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorLockedUntil: true },
  });
  if (user?.twoFactorLockedUntil && user.twoFactorLockedUntil.getTime() > Date.now()) {
    return { lockedUntil: user.twoFactorLockedUntil };
  }
  return null;
}

export async function recordFailedAttempt(userId: string): Promise<{ locked: boolean; attemptsRemaining: number }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { twoFactorFailedAttempts: { increment: 1 } },
    select: { twoFactorFailedAttempts: true },
  });

  if (user.twoFactorFailedAttempts >= MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorLockedUntil: new Date(Date.now() + LOCKOUT_MS),
        twoFactorFailedAttempts: 0,
      },
    });
    return { locked: true, attemptsRemaining: 0 };
  }

  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - user.twoFactorFailedAttempts };
}

export async function clearFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null },
  });
}
