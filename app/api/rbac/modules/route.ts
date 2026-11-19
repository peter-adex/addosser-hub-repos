import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden — Super Admin only" }, { status: 403 });
  }

  const modules = await prisma.permModule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { key: true, label: true, icon: true },
  });

  return NextResponse.json({ success: true, data: modules });
}
