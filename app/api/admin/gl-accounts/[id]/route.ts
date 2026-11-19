import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { z }                         from "zod";

export const dynamic = "force-dynamic";

const UpdateGLSchema = z.object({
  name:        z.string().min(2).optional(),
  category:    z.string().min(2).optional(),
  description: z.string().optional(),
  isActive:    z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gl = await prisma.gLAccount.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { entityAccounts: true } } },
  });

  if (!gl) return NextResponse.json({ error: "GL Account not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: gl });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = session.user as any;
  if (!admin.isSystem && admin.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = UpdateGLSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const before  = await prisma.gLAccount.findUnique({ where: { id: params.id } });
  if (!before)  return NextResponse.json({ error: "GL Account not found" }, { status: 404 });

  const updated = await prisma.gLAccount.update({ where: { id: params.id }, data: parsed.data });

  const action = parsed.data.isActive !== undefined
    ? parsed.data.isActive ? "GL_ACCOUNT_ENABLED" : "GL_ACCOUNT_DISABLED"
    : "GL_ACCOUNT_UPDATED";

  await logAudit({
    userId: admin.id, action, module: "admin",
    resourceId: params.id, resourceType: "GLAccount",
    beforeData: JSON.stringify(before), afterData: JSON.stringify(updated), req,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = session.user as any;
  if (!admin.isSystem) return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });

  const gl = await prisma.gLAccount.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { entityAccounts: true } } },
  });
  if (!gl) return NextResponse.json({ error: "GL Account not found" }, { status: 404 });

  if (gl._count.entityAccounts > 0) {
    return NextResponse.json({
      error: `Cannot delete — this GL account is used by ${gl._count.entityAccounts} entity budget(s). Disable it instead.`,
    }, { status: 409 });
  }

  await prisma.gLAccount.delete({ where: { id: params.id } });

  await logAudit({
    userId: admin.id, action: "GL_ACCOUNT_DELETED", module: "admin",
    resourceId: params.id, resourceType: "GLAccount",
    beforeData: JSON.stringify(gl), req,
  });

  return NextResponse.json({ success: true });
}
