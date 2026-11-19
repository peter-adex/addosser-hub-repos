import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { getBaseUrl }                from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function GET(
  req:    NextRequest,
  { params }: { params: { id: string } }
) {
  const baseUrl    = getBaseUrl();
  const redirectTo = req.nextUrl.searchParams.get("redirect");

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });

  if (!notification) {
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  }

  if (!notification.isRead) {
    await prisma.notification.update({
      where: { id: params.id },
      data:  { isRead: true, readAt: new Date() },
    }).catch(() => {});
  }

  const destination = redirectTo
    ?? notification.actionUrl
    ?? "/dashboard";

  const fullUrl = destination.startsWith("http")
    ? destination
    : `${baseUrl}${destination}`;

  return NextResponse.redirect(fullUrl);
}
