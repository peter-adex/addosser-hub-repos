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
const GLSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
<<<<<<< HEAD
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const { searchParams } = new URL(req.url);
  const isActive = searchParams.get("active") !== "false";

  const accounts = await prisma.gLAccount.findMany({
    where: { isActive },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ success: true, data: accounts });
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
  const parsed = GLSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.gLAccount.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing)
    return NextResponse.json(
      { error: "GL Account with this code already exists" },
      { status: 409 },
    );

  const account = await prisma.gLAccount.create({ data: parsed.data });

  await logAudit({
    userId: user.id,
    action: "GL_ACCOUNT_CREATED",
    module: "admin",
    resourceId: account.id,
    meta: { code: account.code },
  });
=======
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = GLSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.gLAccount.findUnique({ where: { code: parsed.data.code } });
  if (existing) return NextResponse.json({ error: "GL Account with this code already exists" }, { status: 409 });

  const account = await prisma.gLAccount.create({ data: parsed.data });

  await logAudit({ userId: user.id, action: "GL_ACCOUNT_CREATED", module: "admin", resourceId: account.id, meta: { code: account.code } });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  return NextResponse.json({ success: true, data: account }, { status: 201 });
}
