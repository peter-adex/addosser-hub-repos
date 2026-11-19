import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

<<<<<<< HEAD
export const dynamic = "force-dynamic";

=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
const EntitySchema = z.object({
  name: z.string().min(3),
  code: z.string().min(2).max(10).toUpperCase(),
  type: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entities = await prisma.entity.findMany({
    include: { _count: { select: { users: true, glAccounts: true } } },
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entities = await prisma.entity.findMany({
    include: { _count: { select: { users: true, budgets: true } } },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ success: true, data: entities });
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
  const parsed = EntitySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const codeClash = await prisma.entity.findUnique({
    where: { code: parsed.data.code },
    select: { id: true },
  });
  if (codeClash) {
    return NextResponse.json(
      { error: "Entity Code already exists. Please enter a unique Entity Code." },
      { status: 409 },
    );
  }
  const nameClash = await prisma.entity.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (nameClash) {
    return NextResponse.json(
      { error: `Entity "${parsed.data.name}" already exists. Please enter a unique Entity Name.` },
      { status: 409 },
    );
  }

  const entity = await prisma.entity.create({ data: parsed.data });

  await logAudit({
    userId: user.id,
    action: "ENTITY_CREATED",
    module: "admin",
    resourceId: entity.id,
    meta: { name: entity.name },
  });
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = EntitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.entity.findFirst({ where: { OR: [{ name: parsed.data.name }, { code: parsed.data.code }] } });
  if (existing) return NextResponse.json({ error: "Entity with same name or code already exists" }, { status: 409 });

  const entity = await prisma.entity.create({ data: parsed.data });

  await logAudit({ userId: user.id, action: "ENTITY_CREATED", module: "admin", resourceId: entity.id, meta: { name: entity.name } });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  return NextResponse.json({ success: true, data: entity }, { status: 201 });
}
