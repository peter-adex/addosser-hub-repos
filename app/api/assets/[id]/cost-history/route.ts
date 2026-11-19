import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssetCostHistory, checkDuplicateAssetExpense } from "@/lib/asset-cost-history";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const windowsParam = searchParams.get("windows");
  const windows = windowsParam
    ? windowsParam.split(",").map((n) => parseInt(n.trim())).filter((n) => !isNaN(n) && n > 0)
    : undefined;

  const history = await getAssetCostHistory(params.id, { windows });

  let duplicateCheck: Awaited<ReturnType<typeof checkDuplicateAssetExpense>> | null = null;
  const glAccountCode = searchParams.get("glAccountCode");
  if (glAccountCode) {
    const transactionDate = searchParams.get("transactionDate") ? new Date(searchParams.get("transactionDate")!) : undefined;
    const windowDays = searchParams.get("duplicateWindowDays") ? parseInt(searchParams.get("duplicateWindowDays")!) : undefined;
    duplicateCheck = await checkDuplicateAssetExpense({
      assetId: params.id,
      glAccountCode,
      transactionDate,
      windowDays,
    });
  }

  return NextResponse.json({ success: true, data: { ...history, duplicateCheck } });
}
