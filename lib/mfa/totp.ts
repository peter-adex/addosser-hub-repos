import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = { step: 30, digits: 6, window: 1 };

const ISSUER = "Addosser Enterprise Hub";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildEnrollmentUris(accountEmail: string, secret: string) {
  const otpauth = authenticator.keyuri(accountEmail, ISSUER, secret);
  return { otpauth, manualKey: secret };
}

export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });
}

export function currentTimeStep(): number {
  return Math.floor(Date.now() / 1000 / authenticator.options.step!);
}

export function verifyTotpCode(
  code: string,
  secret: string,
  lastUsedStep: number | null,
): { valid: boolean; usedStep: number } {
  const step = currentTimeStep();

  if (lastUsedStep != null && step <= lastUsedStep) {
    return { valid: false, usedStep: step };
  }

  const valid = authenticator.check(code.trim(), secret);
  return { valid, usedStep: step };
}
