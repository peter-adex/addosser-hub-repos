import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get("page")     ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "30");
  const userId   = searchParams.get("userId")   || undefined;
  const module   = searchParams.get("module")   || undefined;
  const action   = searchParams.get("action")   || undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo   = searchParams.get("dateTo")   || undefined;
  const search   = searchParams.get("q")        || undefined;

  const where: any = {
    ...(userId ? { userId } : {}),
    ...(module ? { module } : {}),
    ...(action ? { action: { contains: action } } : {}),
    ...(search ? {
      OR: [
        { action:    { contains: search } },
        { module:    { contains: search } },
        { ipAddress: { contains: search } },
        { meta:      { contains: search } },
      ],
    } : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      },
    } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    success:    true,
    data:       logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
