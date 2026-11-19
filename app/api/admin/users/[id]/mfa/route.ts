import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearRecoveryCodes } from "@/lib/mfa/recovery-codes";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function requireSuperAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const actor = session.user as any;
  if (!actor.isSystem && actor.roleName !== "Super Admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperAdmin(req);
  if (guard.error) return guard.error;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      twoFactorEnabled: true,
      twoFactorEnrolledAt: true,
      twoFactorVerifiedAt: true,
      twoFactorResetAt: true,
      twoFactorResetByAdmin: { select: { id: true, name: true, email: true } },
      twoFactorLockedUntil: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: user });
}

const ActionSchema = z.object({
  action: z.enum(["reset", "require_reverify"]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperAdmin(req);
  if (guard.error) return guard.error;
  const actor = guard.actor!;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (parsed.data.action === "reset") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: params.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorEnrolledAt: null,
          twoFactorVerifiedAt: null,
          twoFactorLastUsedStep: null,
          twoFactorFailedAttempts: 0,
          twoFactorLockedUntil: null,
          twoFactorResetAt: new Date(),
          twoFactorResetById: actor.id,
        },
      }),
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: params.id } }),
    ]);

    await logAudit({
      userId: actor.id,
      action: "MFA_RESET_BY_ADMIN",
      module: "admin",
      resourceId: params.id,
      resourceType: "User",
      req,
      afterData: JSON.stringify({ targetUserEmail: target.email }),
    });

    return NextResponse.json({
      success: true,
      message: "2FA has been reset. The user must enroll again at next login.",
    });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { twoFactorVerifiedAt: null },
  });

  await logAudit({
    userId: actor.id,
    action: "MFA_REVERIFY_REQUIRED_BY_ADMIN",
    module: "admin",
    resourceId: params.id,
    resourceType: "User",
    req,
    afterData: JSON.stringify({ targetUserEmail: target.email }),
  });

  return NextResponse.json({
    success: true,
    message: "The user will be asked to re-verify their 2FA code on their next request.",
  });
}
