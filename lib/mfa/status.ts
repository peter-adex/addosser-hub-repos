import { getMfaReauthIntervalDays } from "./config";

export type MfaStatus = "enrollment_required" | "verification_required" | "verified";

export interface MfaRelevantUser {
  twoFactorEnabled: boolean;
  twoFactorVerifiedAt: Date | null;
}

export async function computeMfaStatus(user: MfaRelevantUser): Promise<MfaStatus> {
  if (!user.twoFactorEnabled) return "enrollment_required";
  if (!user.twoFactorVerifiedAt) return "verification_required";

  const intervalDays = await getMfaReauthIntervalDays();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  if (Date.now() - user.twoFactorVerifiedAt.getTime() > intervalMs) {
    return "verification_required";
  }
  return "verified";
}

export function computeMfaStatusFromClaims(claims: {
  mfaEnabled?: boolean;
  mfaVerifiedAt?: number | null;
  mfaIntervalDays?: number;
}): MfaStatus {
  if (!claims.mfaEnabled) return "enrollment_required";
  if (!claims.mfaVerifiedAt) return "verification_required";

  const intervalDays = claims.mfaIntervalDays ?? 14;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  if (Date.now() - claims.mfaVerifiedAt > intervalMs) return "verification_required";
  return "verified";
}
