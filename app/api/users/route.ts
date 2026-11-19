import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";

<<<<<<< HEAD
export const dynamic = "force-dynamic";

=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const roleId = searchParams.get("roleId");
  const search = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  const where: any = {
    ...(entityId ? { entityId } : {}),
    ...(roleId ? { roleId } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true, entity: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: users.map((u) => ({ ...u, passwordHash: undefined })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  roleId: z.string().cuid().optional(),
  entityId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { userId, ...rest } = body;
  const parsed = UpdateUserSchema.safeParse(rest);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    include: { role: true, entity: true },
  });

  await logAudit({
    userId: (session.user as any).id,
    action: "USER_UPDATED",
    module: "admin",
    resourceId: userId,
    meta: parsed.data,
  });

  return NextResponse.json({ success: true, data: { ...updated, passwordHash: undefined } });
}
