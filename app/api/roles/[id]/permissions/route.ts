import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

<<<<<<< HEAD
export const dynamic = "force-dynamic";

const PermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      appId: z.string().cuid(),
      canView: z.boolean(),
      canCreate: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
      canApprove: z.boolean(),
    }),
  ),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem)
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
  const parsed = PermissionsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

=======
const PermissionsSchema = z.object({
  permissions: z.array(z.object({
    appId: z.string().cuid(),
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canApprove: z.boolean(),
  })),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = await prisma.role.findUnique({ where: { id: params.id } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "System roles cannot be modified" }, { status: 409 });

  const body = await req.json();
  const parsed = PermissionsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  // Upsert all permissions in a transaction
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  await prisma.$transaction(
    parsed.data.permissions.map((p) =>
      prisma.rolePermission.upsert({
        where: { roleId_appId: { roleId: params.id, appId: p.appId } },
<<<<<<< HEAD
        update: {
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canApprove: p.canApprove,
        },
        create: { roleId: params.id, ...p },
      }),
    ),
  );

  await logAudit({
    userId: user.id,
    action: "ROLE_PERMISSIONS_UPDATED",
    module: "admin",
    resourceId: params.id,
  });
=======
        update: { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canApprove: p.canApprove },
        create: { roleId: params.id, ...p },
      })
    )
  );

  await logAudit({ userId: user.id, action: "ROLE_PERMISSIONS_UPDATED", module: "admin", resourceId: params.id });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const updated = await prisma.role.findUnique({
    where: { id: params.id },
    include: { permissions: { include: { app: true } } },
  });

  return NextResponse.json({ success: true, data: updated });
}
