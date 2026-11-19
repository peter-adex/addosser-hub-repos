import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/mfa/crypto";
import { generateTotpSecret, buildEnrollmentUris, generateQrCodeDataUrl } from "@/lib/mfa/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled for this account." },
      { status: 409 },
    );
  }

  const secret = generateTotpSecret();
  const { otpauth, manualKey } = buildEnrollmentUris(user.email, secret);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauth);

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: encryptSecret(secret),
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: null,
      twoFactorLastUsedStep: null,
    },
  });

  return NextResponse.json({ qrCodeDataUrl, manualKey });
}
