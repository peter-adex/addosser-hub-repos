import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json(
      { error: "Forbidden — Super Admin only" },
      { status: 403 },
    );
  }

  const modules = await prisma.permModule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      pages: {
        where: { isActive: true },
        select: { id: true, _count: { select: { actions: true } } },
      },
    },
  });

  const grants = await prisma.rolePagePermission.findMany({
    where: { roleId: params.id, granted: true },
    select: { pageId: true },
  });
  const grantedByPage = new Map<string, number>();
  for (const g of grants) {
    grantedByPage.set(g.pageId, (grantedByPage.get(g.pageId) ?? 0) + 1);
  }

  const summary = modules.map((m) => {
    const total = m.pages.reduce((s, p) => s + p._count.actions, 0);
    const granted = m.pages.reduce(
      (s, p) => s + Math.min(p._count.actions, grantedByPage.get(p.id) ?? 0),
      0,
    );
    return {
      key: m.key,
      label: m.label,
      icon: m.icon,
      totalActions: total,
      grantedActions: granted,
    };
  });

  return NextResponse.json({ success: true, data: summary });
}
