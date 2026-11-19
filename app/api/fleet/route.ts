import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const VehicleSchema = z.object({
  entityId: z.string().cuid(),
  plateNo: z.string().min(5),
  make: z.string().min(2),
  model: z.string().min(1),
  year: z.number().int().min(2000).max(2030),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  glAccountFuel: z.string().optional(),
  glAccountRM: z.string().optional(),
  currentMileage: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasPermission("fleet", "canView");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const status = searchParams.get("status");

  const vehicles = await prisma.vehicle.findMany({
    where: { ...(entityId ? { entityId } : {}), ...(status ? { status: status as any } : {}) },
    include: {
      entity: { select: { name: true, code: true } },
      fleetLogs: { orderBy: { date: "desc" }, take: 1 },
    },
    orderBy: { plateNo: "asc" },
  });

  return NextResponse.json({ success: true, data: vehicles });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = await hasPermission("fleet", "canCreate");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = VehicleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.vehicle.findUnique({ where: { plateNo: parsed.data.plateNo } });
  if (existing) return NextResponse.json({ error: "Vehicle with this plate number already exists" }, { status: 409 });

  const vehicle = await prisma.vehicle.create({ data: parsed.data });

  await logAudit({ userId: (session.user as any).id, action: "VEHICLE_CREATED", module: "fleet", entityId: vehicle.entityId, resourceId: vehicle.id });

  return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
}
