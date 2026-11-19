import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  name:   z.string().min(2).optional(),
  avatar: z.string().refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), {
    message: "avatar must be an absolute URL or an internal /api/files/... path",
  }).nullable().optional(),
  avatarStorageProvider: z.string().nullable().optional(),
  avatarStorageKey:      z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body   = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, pendingName: true },
  });
  if (!current) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data: Record<string, any> = {};
  let nameChangeRequested = false;

  if (parsed.data.avatar !== undefined) {
    data.avatar = parsed.data.avatar;
    if (parsed.data.avatarStorageProvider !== undefined) {
      data.avatarStorageProvider = parsed.data.avatarStorageProvider;
    }
    if (parsed.data.avatarStorageKey !== undefined) {
      data.avatarStorageKey = parsed.data.avatarStorageKey;
    }
  }

  if (parsed.data.name !== undefined && parsed.data.name !== current.name) {
    if (parsed.data.name !== current.pendingName) {
      data.pendingName = parsed.data.name;
      data.pendingNameRequestedAt = new Date();
      nameChangeRequested = true;
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, avatar: true, pendingName: true, pendingNameRequestedAt: true },
  });

  if (nameChangeRequested) {
    try {
      const admins = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ role: { isSystem: true } }, { role: { name: "Super Admin" } }],
        },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "INFO" as const,
            title: "Name Change Request",
            message: `${current.name} has requested to change their name to "${parsed.data.name}". Review it in Admin → Users.`,
            actionUrl: "/admin",
          })),
        });
      }
    } catch (err) {
      console.error("[Profile] Failed to notify admins of name change request:", err);
    }
  }

  return NextResponse.json({
    success: true,
    data: updated,
    nameChangeRequested,
  });
}
