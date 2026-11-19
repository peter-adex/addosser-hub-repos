import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = session.user as any;
  if (!admin.isSystem && admin.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden — audit logs are restricted to admin" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get("userId");
  const module_  = searchParams.get("module");
  const action   = searchParams.get("action");
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const q        = searchParams.get("q");
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1"));
  const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "25"));

  const where: any = {};

  if (userId)  where.userId  = userId;
  if (module_) where.module  = { contains: module_ };
  if (action)  where.action  = { contains: action };

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  if (q) {
    where.OR = [
      { action:       { contains: q } },
      { module:       { contains: q } },
      { resourceType: { contains: q } },
      { ipAddress:    { contains: q } },
      { location:     { contains: q } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
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
