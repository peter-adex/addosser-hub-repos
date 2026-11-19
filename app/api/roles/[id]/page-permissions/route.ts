import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  if (!user.isSystem && user.roleName !== "Super Admin") {
    return { error: NextResponse.json({ error: "Forbidden — Super Admin only" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const moduleKey = searchParams.get("moduleKey");
  if (!moduleKey) return NextResponse.json({ error: "moduleKey is required" }, { status: 400 });

  const mod = await prisma.permModule.findUnique({
    where: { key: moduleKey },
    include: { pages: { include: { actions: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!mod) return NextResponse.json({ error: `Module "${moduleKey}" not found` }, { status: 404 });

  const grants = await prisma.rolePagePermission.findMany({
    where: { roleId: params.id, granted: true, page: { moduleId: mod.id } },
    select: { pageId: true, actionId: true },
  });
  const grantedSet = new Set(grants.map((g) => `${g.pageId}:${g.actionId}`));

  const tree = {
    key: mod.key,
    label: mod.label,
    icon: mod.icon,
    pages: mod.pages
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        key: p.key,
        label: p.label,
        href: p.href,
        actions: p.actions
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((a) => ({
            id: a.id,
            key: a.key,
            label: a.label,
            granted: grantedSet.has(`${p.id}:${a.id}`),
          })),
      })),
  };

  return NextResponse.json({ success: true, data: tree });
}

const PutSchema = z.object({
  moduleKey: z.string().min(1),
  grants: z.array(z.object({ pageId: z.string().cuid(), actionId: z.string().cuid(), granted: z.boolean() })),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  const role = await prisma.role.findUnique({ where: { id: params.id } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem) {
    return NextResponse.json({ error: "System roles have full access by design and cannot be individually restricted" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  const { moduleKey, grants } = parsed.data;

  const mod = await prisma.permModule.findUnique({ where: { key: moduleKey } });
  if (!mod) return NextResponse.json({ error: `Module "${moduleKey}" not found` }, { status: 404 });

  const modulePages = await prisma.permPage.findMany({ where: { moduleId: mod.id }, select: { id: true } });
  const modulePageIds = new Set(modulePages.map((p) => p.id));

  const toGrant = grants.filter((g) => g.granted && modulePageIds.has(g.pageId));

  await prisma.$transaction([
    prisma.rolePagePermission.deleteMany({ where: { roleId: params.id, page: { moduleId: mod.id } } }),
    ...(toGrant.length
      ? [
          prisma.rolePagePermission.createMany({
            data: toGrant.map((g) => ({ roleId: params.id, pageId: g.pageId, actionId: g.actionId, granted: true })),
          }),
        ]
      : []),
  ]);

  await logAudit({
    userId: user!.id,
    action: "ROLE_PAGE_PERMISSIONS_UPDATED",
    module: "admin",
    resourceId: params.id,
    afterData: JSON.stringify({ moduleKey, grantCount: toGrant.length }),
  });

  return NextResponse.json({ success: true, data: { grantCount: toGrant.length } });
}
