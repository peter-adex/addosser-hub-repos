import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateBranchSchema = z.object({
  entityId: z.string().cuid(),
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  code: z.string().max(10).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  manager: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const active = searchParams.get("active");

  const branches = await prisma.branch.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(active === "true"
        ? { isActive: true }
        : active === "false"
          ? { isActive: false }
          : {}),
    },
    include: {
      entity: { select: { name: true, code: true } },
      _count: { select: { budgets: true, assets: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data: branches });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = CreateBranchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const existing = await prisma.branch.findUnique({
    where: {
      entityId_name: { entityId: parsed.data.entityId, name: parsed.data.name },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A branch with this name already exists for this entity" },
      { status: 409 },
    );
  }

  const branch = await prisma.branch.create({
    data: parsed.data,
    include: {
      entity: { select: { name: true, code: true } },
      _count: { select: { budgets: true, assets: true } },
    },
  });

  await logAudit({
    userId: user.id,
    action: "BRANCH_CREATED",
    module: "admin",
    resourceId: branch.id,
    meta: { name: branch.name, entityId: branch.entityId },
  });

  return NextResponse.json({ success: true, data: branch }, { status: 201 });
}
