import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { z }                         from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  name:              z.string().min(2, "Name must be at least 2 characters"),
  code:              z.string().min(1).max(10).toUpperCase(),
  description:       z.string().optional(),
  glAccountCode:     z.string().optional(),
  usefulLifeDefault: z.number().int().min(1).max(100).default(4),
  depreciationMethod:z.enum(["STRAIGHT_LINE","REDUCING_BALANCE","NONE"]).default("STRAIGHT_LINE"),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") !== "false";

  const classifications = await prisma.assetClassification.findMany({
    where:   activeOnly ? { isActive: true } : {},
    include: { _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data: classifications });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const existing = await prisma.assetClassification.findFirst({
    where: { OR: [{ name: parsed.data.name }, { code: parsed.data.code }] },
  });
  if (existing) {
    return NextResponse.json({ error: `Classification with this name or code already exists` }, { status: 409 });
  }

  const classification = await prisma.assetClassification.create({ data: parsed.data });

  await logAudit({
    userId:       user.id,
    action:       "ASSET_CLASSIFICATION_CREATED",
    module:       "assets",
    resourceId:   classification.id,
    resourceType: "AssetClassification",
    afterData:    JSON.stringify(parsed.data),
  });

  return NextResponse.json({ success: true, data: classification }, { status: 201 });
}
