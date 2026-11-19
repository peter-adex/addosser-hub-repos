import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMonthlyDepreciationPosting } from "@/lib/depreciation-posting";

export const dynamic = "force-dynamic";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;

  const session = await getServerSession(authOptions);
  if (session?.user) return true;

  if (!secret) return process.env.NODE_ENV !== "production";

  return false;
}

async function handle(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    console.warn("[cron/depreciation] Unauthorized trigger attempt.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMonthlyDepreciationPosting();
    console.log("[cron/depreciation] Run complete:", { processed: result.processed, posted: result.posted, skipped: result.skipped, errors: result.errors });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[cron/depreciation] Run failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Failed to post depreciation" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
