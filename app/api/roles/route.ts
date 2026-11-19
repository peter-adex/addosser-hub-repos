import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

<<<<<<< HEAD
export const dynamic = "force-dynamic";

const CreateRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
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
=======
const CreateRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.object({
    appId: z.string().cuid(),
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canApprove: z.boolean(),
  })),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
});

export async function GET() {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const roles = await prisma.role.findMany({
    include: {
      permissions: { include: { app: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data: roles });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateRoleSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateRoleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const { name, description, permissions } = parsed.data;

  const existing = await prisma.role.findUnique({ where: { name } });
<<<<<<< HEAD
  if (existing)
    return NextResponse.json(
      { error: "A role with this name already exists" },
      { status: 409 },
    );
=======
  if (existing) return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const role = await prisma.role.create({
    data: {
      name,
      description,
      permissions: { create: permissions },
    },
    include: { permissions: { include: { app: true } } },
  });

<<<<<<< HEAD
  await logAudit({
    userId: user.id,
    action: "ROLE_CREATED",
    module: "admin",
    resourceId: role.id,
    meta: { name },
  });
=======
  await logAudit({ userId: user.id, action: "ROLE_CREATED", module: "admin", resourceId: role.id, meta: { name } });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  return NextResponse.json({ success: true, data: role }, { status: 201 });
}
