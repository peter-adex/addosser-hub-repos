import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMfaReauthIntervalDays, setMfaReauthIntervalDays } from "@/lib/mfa/config";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const actor = session.user as any;
  if (!actor.isSystem && actor.roleName !== "Super Admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const mfaReauthIntervalDays = await getMfaReauthIntervalDays();
  return NextResponse.json({ success: true, data: { mfaReauthIntervalDays } });
}

const BodySchema = z.object({ mfaReauthIntervalDays: z.number().int().min(1).max(365) });

export async function PUT(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;
  const actor = guard.actor!;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "mfaReauthIntervalDays must be an integer 1–365." }, { status: 400 });
  }

  await setMfaReauthIntervalDays(parsed.data.mfaReauthIntervalDays, actor.id);

  await logAudit({
    userId: actor.id,
    action: "SECURITY_SETTING_UPDATED",
    module: "admin",
    resourceType: "SecuritySetting",
    afterData: JSON.stringify({ key: "MFA_REAUTH_INTERVAL_DAYS", value: parsed.data.mfaReauthIntervalDays }),
    req,
  });

  return NextResponse.json({ success: true, data: { mfaReauthIntervalDays: parsed.data.mfaReauthIntervalDays } });
}
