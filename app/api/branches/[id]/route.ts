import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().max(10).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  manager: z.string().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branch = await prisma.branch.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { name: true, code: true } },
      _count: { select: { budgets: true, assets: true } },
    },
  });

  if (!branch)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: branch });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const branch = await prisma.branch.update({
    where: { id: params.id },
    data: parsed.data,
    include: {
      entity: { select: { name: true, code: true } },
      _count: { select: { budgets: true, assets: true } },
    },
  });

  await logAudit({
    userId: user.id,
    action: "BRANCH_UPDATED",
    module: "admin",
    resourceId: params.id,
    meta: { changes: parsed.data },
  });

  return NextResponse.json({ success: true, data: branch });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branch = await prisma.branch.findUnique({
    where: { id: params.id },
    include: { _count: { select: { budgets: true, assets: true } } },
  });
  if (!branch)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  if (branch._count.budgets + branch._count.assets > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete branch — it has ${branch._count.budgets} budget(s) and ${branch._count.assets} asset(s) linked. Disable it instead.`,
      },
      { status: 409 },
    );
  }

  await prisma.branch.delete({ where: { id: params.id } });

  await logAudit({
    userId: user.id,
    action: "BRANCH_DELETED",
    module: "admin",
    resourceId: params.id,
    meta: { name: branch.name },
  });

  return NextResponse.json({ success: true });
}
