import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { z }                         from "zod";

export const dynamic = "force-dynamic";

const UpdateEntitySchema = z.object({
  name:     z.string().min(3).optional(),
  code:     z.string().min(2).max(10).optional(),
  type:     z.string().optional(),
  address:  z.string().optional(),
  phone:    z.string().optional(),
  email:    z.string().email().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = session.user as any;
  if (!admin.isSystem && admin.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = UpdateEntitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const before = await prisma.entity.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

  if (parsed.data.name && parsed.data.name !== before.name) {
    const dup = await prisma.entity.findFirst({ where: { name: parsed.data.name, NOT: { id: params.id } } });
    if (dup) return NextResponse.json({ error: "An entity with this name already exists" }, { status: 409 });
  }

  const updated = await prisma.entity.update({ where: { id: params.id }, data: parsed.data });

  const action = parsed.data.isActive !== undefined
    ? parsed.data.isActive ? "ENTITY_ENABLED" : "ENTITY_DISABLED"
    : "ENTITY_UPDATED";

  await logAudit({
    userId: admin.id, action, module: "admin",
    resourceId: params.id, resourceType: "Entity",
    beforeData: JSON.stringify(before), afterData: JSON.stringify(updated), req,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = session.user as any;
  if (!admin.isSystem) return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });

  const entity = await prisma.entity.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { users: true, glAccounts: true, assets: true } } },
  });
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

  const { users, glAccounts, assets } = entity._count;
  if (users > 0 || glAccounts > 0 || assets > 0) {
    return NextResponse.json({
      error: `Cannot delete — entity has ${users} user(s), ${glAccounts} GL account(s), and ${assets} asset(s). Disable it instead.`,
    }, { status: 409 });
  }

  await prisma.entity.delete({ where: { id: params.id } });

  await logAudit({
    userId: admin.id, action: "ENTITY_DELETED", module: "admin",
    resourceId: params.id, resourceType: "Entity",
    beforeData: JSON.stringify(entity), req,
  });

  return NextResponse.json({ success: true });
}
