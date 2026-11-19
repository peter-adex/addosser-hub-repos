import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processDueReminders } from "@/lib/payment-v2";

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
    console.warn("[cron/reminders] Unauthorized trigger attempt.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueReminders();
    console.log("[cron/reminders] Run complete:", result);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[cron/reminders] Run failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Failed to process reminders" },
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
