import { NextRequest, NextResponse }  from "next/server";
import { getServerSession }           from "next-auth";
import { authOptions }                from "@/lib/auth";
import { prisma }                     from "@/lib/prisma";
import { logAudit }                   from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { z }                          from "zod";

export const dynamic = "force-dynamic";

const CreateMaintenanceSchema = z.object({
  type:         z.enum(["PREVENTIVE","CORRECTIVE","INSPECTION","CALIBRATION","UPGRADE"]),
  description:  z.string().optional(),
  cost:         z.number().nonnegative().optional(),
  glAccountCode:z.string().optional(),
  vendor:       z.string().optional(),
  performedAt:  z.string(),
  nextDueAt:    z.string().optional(),
  status:       z.string().default("Completed"),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasGranularPermission("assets", "edit", "view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const logs = await prisma.assetMaintenance.findMany({
    where:   { assetId: params.id },
    orderBy: { performedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: logs });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = await hasGranularPermission("assets", "edit", "create");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const body   = await req.json();
  const parsed = CreateMaintenanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const { performedAt, nextDueAt, ...rest } = parsed.data;

  const log = await prisma.assetMaintenance.create({
    data: {
      assetId:    params.id,
      ...rest,
      performedAt: new Date(performedAt),
      nextDueAt:   nextDueAt ? new Date(nextDueAt) : undefined,
    },
  });

  await logAudit({
    userId:       (session.user as any).id,
    action:       "ASSET_MAINTENANCE_LOGGED",
    module:       "assets",
    entityId:     asset.entityId,
    resourceId:   params.id,
    resourceType: "Asset",
    afterData:    JSON.stringify({ type: rest.type, cost: rest.cost, performedAt }),
  });

  return NextResponse.json({ success: true, data: log }, { status: 201 });
}
