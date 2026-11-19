import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const userEntityId = (session.user as any).entityId;

  try {
    const roleId = (session.user as any).roleId as string | null | undefined;

    const unreadOr = [
      ...(userId ? [{ userId }] : []),
      ...(roleId && userEntityId
        ? [
            {
              relatedInstanceId: { not: null },
              user: {
                is: {
                  roleId,
                  entityId: userEntityId,
                },
              },
            },
          ]
        : []),
    ];

    const unreadCount = unreadOr.length
      ? await prisma.notification.count({
          where: { isRead: false, OR: unreadOr },
        })
      : 0;

    const invoiceOr = [
      ...(userEntityId ? [{ entityId: userEntityId }] : []),
      ...(userId ? [{ submittedById: userId }] : []),
    ];

    const latestInvoiceState = invoiceOr.length
      ? await prisma.invoice.aggregate({
          where: { OR: invoiceOr },
          _count: true,
          _max: { updatedAt: true },
        })
      : { _count: 0, _max: { updatedAt: null as Date | null } };

    return NextResponse.json({
      success: true,
      data: {
        unreadCount,
        invoiceCount: latestInvoiceState._count,
        lastUpdatedMarker:
          latestInvoiceState._max.updatedAt?.toISOString() ?? "",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
