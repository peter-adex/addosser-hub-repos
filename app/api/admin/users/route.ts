import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = session.user as any;
  if (!actor.isSystem && actor.roleName !== "Super Admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    include: { role: true, entity: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: users.map((u) => ({ ...u, passwordHash: undefined, twoFactorSecret: undefined })),
  });
}
