import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
<<<<<<< HEAD
import { getBaseUrl } from "@/lib/base-url";
import { sendInvitationEmail } from "@/lib/resend";
import { z } from "zod";

export const dynamic = "force-dynamic";

const InviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  roleId: z.string().min(1, "Role is required"),
  entityId: z.string().min(1, "Primary entity is required"),
  extraEntityIds: z.array(z.string()).optional().default([]),
  approvalLimit: z.union([z.string(), z.number()]).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error("[Invite] Session error:", err);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 },
    );
  }

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caller = session.user as any;
  if (!caller.isSystem && caller.roleName !== "Super Admin") {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const {
    email,
    name,
    roleId,
    entityId,
    extraEntityIds = [],
    approvalLimit,
  } = parsed.data;
  const normalEmail = email.toLowerCase().trim();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: `A user with email ${normalEmail} already exists` },
        { status: 409 },
      );
    }

    await prisma.invitation.updateMany({
      where: { email: normalEmail, acceptedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    let parsedLimit: number | null = null;
    if (
      approvalLimit !== undefined &&
      approvalLimit !== null &&
      approvalLimit !== ""
    ) {
      const raw =
        typeof approvalLimit === "string"
          ? parseFloat(approvalLimit.replace(/,/g, ""))
          : Number(approvalLimit);
      if (!isNaN(raw) && raw > 0) parsedLimit = raw;
    }

    const invitation = await prisma.invitation.create({
      data: {
        email: normalEmail,
        name,
        roleId,
        entityId,
        extraEntityIds:
          extraEntityIds.length > 0 ? JSON.stringify(extraEntityIds) : null,
        approvalLimit: parsedLimit,
        invitedById: caller.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const baseUrl = getBaseUrl();
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

    const [role, entity, inviter] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId }, select: { name: true } }),
      prisma.entity.findUnique({
        where: { id: entityId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: caller.id },
        select: { name: true },
      }),
    ]);

    try {
      await sendInvitationEmail({
        to: normalEmail,
        name,
        inviterName: inviter?.name ?? "Administrator",
        role: role?.name ?? "User",
        entity: entity?.name ?? "",
        inviteUrl,
      });
    } catch (emailErr) {
      console.error(
        "[Invite] Email send failed (invitation still created):",
        emailErr,
      );
    }

    await logAudit({
      userId: caller.id,
      action: "USER_INVITED",
      module: "admin",
      resourceType: "Invitation",
      resourceId: invitation.id,
      afterData: JSON.stringify({ email: normalEmail, roleId, entityId }),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Invitation sent to ${normalEmail}`,
        data: { inviteUrl, invitationId: invitation.id },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[Invite] Database error:", err);

    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "An invitation for this email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: err?.message ?? "Failed to create invitation. Please try again.",
      },
      { status: 500 },
    );
  }
=======
import { sendInvitationEmail } from "@/lib/resend";
import { z } from "zod";
import { addDays } from "date-fns";

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  roleId: z.string().cuid(),
  entityId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const { email, name, roleId, entityId } = parsed.data;

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Invalidate any prior invite
  await prisma.invitation.updateMany({
    where: { email: email.toLowerCase(), acceptedAt: null },
    data: { expiresAt: new Date() },
  });

  const invitation = await prisma.invitation.create({
    data: {
      email: email.toLowerCase(),
      roleId,
      entityId,
      invitedById: user.id,
      expiresAt: addDays(new Date(), 7),
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;
  const [role, entity, inviter] = await Promise.all([
    prisma.role.findUnique({ where: { id: roleId } }),
    prisma.entity.findUnique({ where: { id: entityId } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
  ]);

  try {
    await sendInvitationEmail({
      to: email,
      name,
      inviterName: inviter?.name ?? "Administrator",
      role: role?.name ?? "User",
      entity: entity?.name ?? "",
      inviteUrl,
    });
  } catch (e) {
    console.error("[Invite] Email failed:", e);
  }

  await logAudit({
    userId: user.id,
    action: "USER_INVITED",
    module: "admin",
    meta: { email, roleId, entityId },
  });

  return NextResponse.json({ success: true, data: { inviteUrl } }, { status: 201 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
