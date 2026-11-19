import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
});

function isAuthorizedAdmin(session: any): boolean {
  const user = session?.user as any;
  return !!user && (user.isSystem || user.roleName === "Super Admin");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAuthorizedAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = await prisma.role.findUnique({ where: { id: params.id } });
  if (!role)
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem)
    return NextResponse.json(
      { error: "System roles cannot be modified" },
      { status: 409 },
    );

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  if (parsed.data.name) {
    const existing = await prisma.role.findFirst({
      where: { name: parsed.data.name, id: { not: params.id } },
    });
    if (existing)
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 409 },
      );
  }

  const updated = await prisma.role.update({
    where: { id: params.id },
    data: parsed.data,
  });
  await logAudit({
    userId: (session.user as any).id,
    action: "ROLE_UPDATED",
    module: "admin",
    resourceId: params.id,
  });
  return NextResponse.json({ success: true, data: updated });
}

const DeleteSchema = z.object({
  reassignToRoleId: z.string().cuid().optional(),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAuthorizedAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = await prisma.role.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!role)
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem)
    return NextResponse.json(
      { error: "System roles cannot be deleted" },
      { status: 409 },
    );

  let reassignToRoleId: string | undefined;
  const rawBody = await req.text();
  if (rawBody) {
    const parsed = DeleteSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    reassignToRoleId = parsed.data.reassignToRoleId;
  }

  if (role._count.users > 0) {
    if (!reassignToRoleId) {
      return NextResponse.json(
        {
          error: `Cannot delete — ${role._count.users} user(s) are assigned to this role`,
          usersAssigned: role._count.users,
        },
        { status: 409 },
      );
    }

    const replacement = await prisma.role.findUnique({ where: { id: reassignToRoleId } });
    if (!replacement) {
      return NextResponse.json({ error: "Replacement role not found" }, { status: 404 });
    }
    if (replacement.id === role.id) {
      return NextResponse.json({ error: "Replacement role must be different from the role being deleted" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.updateMany({ where: { roleId: role.id }, data: { roleId: replacement.id } }),
      prisma.role.delete({ where: { id: role.id } }),
    ]);

    await logAudit({
      userId: (session.user as any).id,
      action: "ROLE_DELETED_WITH_REASSIGNMENT",
      module: "admin",
      resourceId: params.id,
      afterData: JSON.stringify({ reassignedUsers: role._count.users, reassignToRoleId }),
    });
    return NextResponse.json({ success: true, reassignedUsers: role._count.users });
  }

  await prisma.role.delete({ where: { id: params.id } });
  await logAudit({
    userId: (session.user as any).id,
    action: "ROLE_DELETED",
    module: "admin",
    resourceId: params.id,
  });
  return NextResponse.json({ success: true });
}
