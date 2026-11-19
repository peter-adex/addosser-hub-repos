import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession, requirePermission } from "@/lib/api-helpers";
import { processFleetDocumentNotifications } from "@/lib/fleet-document-notifications";

export const dynamic = "force-dynamic";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;

  const session = await getRequiredSession();
  if (session && !requirePermission(session, "fleet-settings", "canEdit")) return true;

  if (!secret && !session) return process.env.NODE_ENV !== "production";
  return false;
}

async function handle(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    console.warn("[cron/fleet-document-notifications] Unauthorized trigger attempt.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processFleetDocumentNotifications();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[cron/fleet-document-notifications] Run failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Failed to process notifications" },
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
