import { prisma } from "@/lib/prisma";

export const MFA_REAUTH_INTERVAL_KEY = "MFA_REAUTH_INTERVAL_DAYS";
const DEFAULT_INTERVAL_DAYS = 14;
const CACHE_TTL_MS = 30_000;

let cached: { value: number; expiresAt: number } | null = null;

export async function getMfaReauthIntervalDays(): Promise<number> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await prisma.securitySetting.findUnique({
    where: { key: MFA_REAUTH_INTERVAL_KEY },
  });

  let value: number;
  if (row) {
    const parsed = Number(row.value);
    value = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_DAYS;
  } else {
    const fromEnv = Number(process.env.MFA_REAUTH_INTERVAL_DAYS);
    value = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_INTERVAL_DAYS;
  }

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function setMfaReauthIntervalDays(days: number, updatedById: string): Promise<void> {
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    throw new Error("MFA re-auth interval must be a number of days between 1 and 365.");
  }
  await prisma.securitySetting.upsert({
    where: { key: MFA_REAUTH_INTERVAL_KEY },
    create: { key: MFA_REAUTH_INTERVAL_KEY, value: String(days), updatedById },
    update: { value: String(days), updatedById },
  });
  cached = null;
}
