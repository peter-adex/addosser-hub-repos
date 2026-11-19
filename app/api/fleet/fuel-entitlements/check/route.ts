import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasGranularPermission } from "@/lib/permissions";
import { checkFuelEntitlement } from "@/lib/fuel-entitlement-validation";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = await hasGranularPermission("invoice", "invoices", "create");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId");
  const fuelType = searchParams.get("fuelType");
  const requestedAmount = parseFloat(searchParams.get("requestedAmount") ?? "");

  if (!vehicleId || (fuelType !== "litres" && fuelType !== "naira") || !requestedAmount || requestedAmount <= 0) {
    return NextResponse.json(
      { error: "vehicleId, fuelType (litres|naira) and a positive requestedAmount are required" },
      { status: 400 },
    );
  }

  const result = await checkFuelEntitlement({ vehicleId, fuelType, requestedAmount });
  return NextResponse.json({ success: true, data: result });
}
