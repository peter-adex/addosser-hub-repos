import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateEntitySchema = z.object({
  name: z.string().min(3).optional(),
  code: z.string().min(2).max(10).toUpperCase().optional(),
  type: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entity = await prisma.entity.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: { users: true, assets: true, branches: true, glAccounts: true },
      },
    },
  });
  if (!entity)
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: entity });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entity = await prisma.entity.findUnique({ where: { id: params.id } });
  if (!entity)
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateEntitySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  if (parsed.data.code && parsed.data.code !== entity.code) {
    const codeClash = await prisma.entity.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });
    if (codeClash && codeClash.id !== params.id) {
      return NextResponse.json(
        { error: "Entity Code already exists. Please enter a unique Entity Code." },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.entity.update({
    where: { id: params.id },
    data: parsed.data,
  });

  const action =
    parsed.data.isActive !== undefined
      ? parsed.data.isActive
        ? "ENTITY_ENABLED"
        : "ENTITY_DISABLED"
      : "ENTITY_UPDATED";

  await logAudit({
    userId: user.id,
    action,
    module: "admin",
    entityId: params.id,
    resourceId: params.id,
    resourceType: "Entity",
    beforeData: JSON.stringify(entity),
    afterData: JSON.stringify(updated),
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem)
    return NextResponse.json(
      { error: "Forbidden — Super Admin only" },
      { status: 403 },
    );

  const entity = await prisma.entity.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true, assets: true } } },
  });
  if (!entity)
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });

  if (entity._count.users > 0 || entity._count.assets > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete entity — it has ${entity._count.users} user(s) and ${entity._count.assets} asset(s). Disable it instead.`,
      },
      { status: 409 },
    );
  }

  await prisma.entity.delete({ where: { id: params.id } });

  await logAudit({
    userId: user.id,
    action: "ENTITY_DELETED",
    module: "admin",
    entityId: params.id,
    resourceId: params.id,
    resourceType: "Entity",
    beforeData: JSON.stringify(entity),
  });

  return NextResponse.json({ success: true });
}
