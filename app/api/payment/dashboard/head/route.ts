import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHeadDashboardStats } from "@/lib/payment-dashboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    const allowed = user.isSystem || perm.assign || perm.approve;
    if (!allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const allowedEntityIds = user.isSystem ? null : user.allowedEntityIds ?? null;
    const stats = await getHeadDashboardStats(allowedEntityIds);

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error("[GET /api/payment/dashboard/head]", err);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
