import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const CODE_COUNT = 10;
const CODE_BYTES = 5;

function generateOneCode(): string {
  const raw = crypto.randomBytes(CODE_BYTES).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const plainCodes = Array.from({ length: CODE_COUNT }, generateOneCode);

  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: await Promise.all(
        plainCodes.map(async (code) => ({
          userId,
          codeHash: await bcrypt.hash(code, 10),
        })),
      ),
    }),
  ]);

  return plainCodes;
}

export async function redeemRecoveryCode(userId: string, candidate: string): Promise<boolean> {
  const normalized = candidate.trim().toUpperCase();
  const unused = await prisma.twoFactorRecoveryCode.findMany({
    where: { userId, usedAt: null },
  });

  for (const record of unused) {
    if (await bcrypt.compare(normalized, record.codeHash)) {
      await prisma.twoFactorRecoveryCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}

export async function clearRecoveryCodes(userId: string): Promise<void> {
  await prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } });
}
