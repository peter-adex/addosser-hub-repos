import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { z }                         from "zod";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name:              z.string().min(2).optional(),
  description:       z.string().optional(),
  glAccountCode:     z.string().optional(),
  usefulLifeDefault: z.number().int().min(1).max(100).optional(),
  depreciationMethod:z.enum(["STRAIGHT_LINE","REDUCING_BALANCE","NONE"]).optional(),
  isActive:          z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.assetClassification.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { assets: true } } },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: c });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const before  = await prisma.assetClassification.findUnique({ where: { id: params.id } });
  const updated = await prisma.assetClassification.update({ where: { id: params.id }, data: parsed.data });

  await logAudit({
    userId:       user.id,
    action:       "ASSET_CLASSIFICATION_UPDATED",
    module:       "assets",
    resourceId:   params.id,
    resourceType: "AssetClassification",
    beforeData:   JSON.stringify(before),
    afterData:    JSON.stringify(updated),
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assetCount = await prisma.asset.count({ where: { classificationId: params.id } });
  if (assetCount > 0) {
    await prisma.assetClassification.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({
      success: true,
      message: `Classification disabled (${assetCount} assets still reference it — hard delete blocked)`,
    });
  }

  await prisma.assetClassification.delete({ where: { id: params.id } });
  await logAudit({
    userId:       user.id,
    action:       "ASSET_CLASSIFICATION_DELETED",
    module:       "assets",
    resourceId:   params.id,
    resourceType: "AssetClassification",
  });
  return NextResponse.json({ success: true });
}
