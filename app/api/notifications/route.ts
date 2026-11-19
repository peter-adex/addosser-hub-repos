import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId   = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const notifications = await prisma.notification.findMany({
    where:   { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return NextResponse.json({ success: true, data: notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body   = await req.json().catch(() => ({}));

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true, message: "All notifications marked as read" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
