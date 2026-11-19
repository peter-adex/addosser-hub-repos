import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
<<<<<<< HEAD
import bcrypt from "bcryptjs";
import { z } from "zod";

const AcceptSchema = z.object({
  token:    z.string(),
=======
import { z } from "zod";
import bcrypt from "bcryptjs";

const AcceptSchema = z.object({
  token: z.string(),
  name: z.string().min(2),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
<<<<<<< HEAD
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request — please try again." }, { status: 400 });
  }

  const parsed = AcceptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { token, password } = parsed.data;

  try {
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
    if (invitation.acceptedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 409 });
    if (new Date() > invitation.expiresAt) return NextResponse.json({ error: "This invitation link has expired. Ask your admin to send a new one." }, { status: 410 });

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) return NextResponse.json({ error: "An account already exists for this email" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    let extraEntityIds: string[] = [];
    if (invitation.extraEntityIds) {
      try { extraEntityIds = JSON.parse(invitation.extraEntityIds); } catch { }
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email:        invitation.email,
          name:         invitation.name || invitation.email.split("@")[0],
          passwordHash,
          roleId:       invitation.roleId,
          entityId:     invitation.entityId,
          invitedAt:    invitation.createdAt,
          invitedBy:    invitation.invitedById,
          entityAccess: extraEntityIds.length > 0
            ? { create: extraEntityIds.map((eid) => ({ entityId: eid })) }
            : undefined,
        },
      });

      await tx.invitation.update({ where: { token }, data: { acceptedAt: new Date() } });

      return newUser;
    });

    await logAudit({
      userId: user.id,
      action: "USER_REGISTERED",
      module: "auth",
      meta:   { email: invitation.email, extraEntityCount: extraEntityIds.length },
    });

    return NextResponse.json({ success: true, message: "Account created successfully. Please sign in." });
  } catch (err: any) {
    console.error("[POST /api/users/accept-invite] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong creating your account. Please try again or contact your administrator." },
      { status: 500 },
    );
  }
=======
  const body = await req.json();
  const parsed = AcceptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { token, name, password } = parsed.data;

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
  if (invitation.acceptedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 409 });
  if (new Date() > invitation.expiresAt) return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });

  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) return NextResponse.json({ error: "Account already exists for this email" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invitation.email,
        name,
        passwordHash,
        roleId: invitation.roleId,
        entityId: invitation.entityId,
        invitedAt: invitation.createdAt,
        invitedBy: invitation.invitedById,
      },
    }),
    prisma.invitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    }),
  ]);

  await logAudit({
    userId: user.id,
    action: "USER_REGISTERED",
    module: "auth",
    meta: { email: invitation.email },
  });

  return NextResponse.json({ success: true, message: "Account created. Please sign in." });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
