import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!params.token) {
    return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
  }

  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: params.token },
      include: {
        role: { select: { name: true } },
        entity: { select: { name: true, code: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
    }
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 409 },
      );
    }
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation link has expired. Ask your admin to send a new one." },
        { status: 410 },
      );
    }

    let extraEntityIds: string[] = [];
    if (invitation.extraEntityIds) {
      try {
        extraEntityIds = JSON.parse(invitation.extraEntityIds);
      } catch {
      }
    }

    const extraEntities = extraEntityIds.length
      ? await prisma.entity.findMany({
          where: { id: { in: extraEntityIds } },
          select: { name: true, code: true },
        })
      : [];

    return NextResponse.json({
      email: invitation.email,
      name: invitation.name,
      roleName: invitation.role.name,
      entity: invitation.entity,
      extraEntities,
    });
  } catch (err: any) {
    console.error("[GET /api/users/invite/[token]] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong loading this invitation. Please try again or contact your administrator." },
      { status: 500 },
    );
  }
}
