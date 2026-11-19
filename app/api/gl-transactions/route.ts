import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGLAccountLedger } from "@/lib/gl-transactions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const glAccountId = searchParams.get("glAccountId");
  const entityId = searchParams.get("entityId") ?? undefined;

  if (!glAccountId) return NextResponse.json({ error: "glAccountId is required" }, { status: 400 });

  const dateFrom = searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined;
  const dateTo = searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined;
  const entryType = searchParams.get("entryType") as "DEBIT" | "CREDIT" | null;
  const sourceType = searchParams.get("sourceType") ?? undefined;
  const referenceNo = searchParams.get("referenceNo") ?? undefined;

  const ledger = await getGLAccountLedger(glAccountId, entityId, {
    dateFrom, dateTo, entryType: entryType ?? undefined, sourceType, referenceNo,
  });
  return NextResponse.json({ success: true, data: ledger });
}
