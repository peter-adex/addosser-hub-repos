import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEntitiesForFilter } from "@/lib/payment-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;
    const allowedEntityIds = user.isSystem ? null : user.allowedEntityIds ?? null;

    const entities = await getEntitiesForFilter(allowedEntityIds);
    return NextResponse.json({ entities });
  } catch (err: any) {
    console.error("[GET /api/payment/entities-lookup]", err);
    return NextResponse.json({ error: "Failed to load entities" }, { status: 500 });
  }
}
