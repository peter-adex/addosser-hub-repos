import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateGLSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gl = await prisma.gLAccount.findUnique({
    where: { id: params.id },
    include: {
      entityAccounts: {
        include: { entity: true, _count: { select: { budgets: true } } },
      },
    },
  });
  if (!gl)
    return NextResponse.json(
      { error: "GL Account not found" },
      { status: 404 },
    );
  return NextResponse.json({ success: true, data: gl });
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

  const gl = await prisma.gLAccount.findUnique({ where: { id: params.id } });
  if (!gl)
    return NextResponse.json(
      { error: "GL Account not found" },
      { status: 404 },
    );

  const body = await req.json();
  const parsed = UpdateGLSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const updated = await prisma.gLAccount.update({
    where: { id: params.id },
    data: parsed.data,
  });

  const action =
    parsed.data.isActive !== undefined
      ? parsed.data.isActive
        ? "GL_ACCOUNT_ENABLED"
        : "GL_ACCOUNT_DISABLED"
      : "GL_ACCOUNT_UPDATED";

  await logAudit({
    userId: user.id,
    action,
    module: "admin",
    resourceId: params.id,
    resourceType: "GLAccount",
    beforeData: JSON.stringify(gl),
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

  const gl = await prisma.gLAccount.findUnique({
    where: { id: params.id },
    include: {
      entityAccounts: { include: { _count: { select: { budgets: true } } } },
    },
  });
  if (!gl)
    return NextResponse.json(
      { error: "GL Account not found" },
      { status: 404 },
    );

  const budgetCount = gl.entityAccounts.reduce(
    (s, e) => s + e._count.budgets,
    0,
  );
  if (budgetCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${budgetCount} budget(s) reference this GL account. Disable it instead.`,
      },
      { status: 409 },
    );
  }

  await prisma.entityGLAccount.deleteMany({
    where: { glAccountId: params.id },
  });
  await prisma.gLAccount.delete({ where: { id: params.id } });

  await logAudit({
    userId: user.id,
    action: "GL_ACCOUNT_DELETED",
    module: "admin",
    resourceId: params.id,
    resourceType: "GLAccount",
    beforeData: JSON.stringify(gl),
  });

  return NextResponse.json({ success: true });
}
