import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchPaymentHistory } from "@/lib/payment-dashboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.view('history') && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const allowedEntityIds = user.isSystem ? null : user.allowedEntityIds ?? null;

    const tranches = await searchPaymentHistory({
      allowedEntityIds,
      entityId: searchParams.get("entityId") || undefined,
      invoiceNo: searchParams.get("invoiceNo") || undefined,
      vendorName: searchParams.get("vendorName") || undefined,
      transactionRef: searchParams.get("transactionRef") || undefined,
      status: searchParams.get("status") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    });

    return NextResponse.json({ tranches });
  } catch (err: any) {
    console.error("[GET /api/payment/history]", err);
    return NextResponse.json({ error: "Failed to load payment history" }, { status: 500 });
  }
}
