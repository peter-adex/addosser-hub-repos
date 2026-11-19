import { getPaymentCaps, getTellerRoleIds } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.assign && !perm.approve && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const allowedEntityIds = user.isSystem ? null : (user.allowedEntityIds ?? null);

    const batches = await prisma.paymentBatch.findMany({
      where: {
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
      },
      include: {
        invoice: {
          include: {
            vendor: { select: { name: true } },
            entity: { select: { name: true, code: true } },
          },
        },
        teller: { select: { id: true, name: true, email: true } },
        tranches: { orderBy: { trancheNumber: "asc" } },
      },
      orderBy: { assignedAt: "desc" },
    });

    const tellerRoleIds = await getTellerRoleIds();

    const tellers = await prisma.user.findMany({
      where: {
        isActive: true,
        roleId: { in: tellerRoleIds },
      },
      select: { id: true, name: true, email: true, entityId: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ batches, tellers });
  } catch (err: any) {
    console.error("[GET /api/payment/assigned]", err);
    return NextResponse.json({ error: "Failed to load assigned tasks" }, { status: 500 });
  }
}
