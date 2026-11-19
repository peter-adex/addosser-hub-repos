import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const branchId = searchParams.get("branchId");

  if (!entityId || !branchId) {
    return NextResponse.json({ error: "entityId and branchId are required" }, { status: 400 });
  }

  const [entity, branch] = await Promise.all([
    prisma.entity.findUnique({ where: { id: entityId }, select: { code: true } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { code: true, name: true } }),
  ]);

  if (!entity || !branch) {
    return NextResponse.json({ error: "Entity or branch not found" }, { status: 404 });
  }

  const entityCode = entity.code.toUpperCase();
  const branchCode = (branch.code?.toUpperCase() || branch.name.split(" ").map((w) => w[0]).join("").slice(0, 3)).toUpperCase();
  const prefix     = `${entityCode}/${branchCode}/`;

  const count = await prisma.asset.count({
    where: { entityId, branchId },
  });

  const seq    = String(count + 1).padStart(6, "0");
  const assetTag = `${prefix}${seq}`;

  const collision = await prisma.asset.findUnique({ where: { assetNo: assetTag } });
  if (collision) {
    const globalCount = await prisma.asset.count({ where: { entityId } });
    const fallbackTag = `${prefix}${String(globalCount + 1).padStart(6, "0")}`;
    return NextResponse.json({ success: true, data: { assetTag: fallbackTag, entityCode, branchCode } });
  }

  return NextResponse.json({ success: true, data: { assetTag, entityCode, branchCode } });
}
