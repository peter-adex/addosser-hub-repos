import { prisma } from "@/lib/prisma";

export async function getRoleIdsWithPageAction(
  moduleKey: string,
  pageKey: string,
  actionKey: string,
): Promise<string[]> {
  const [grants, systemRoles] = await Promise.all([
    prisma.rolePagePermission.findMany({
      where: {
        granted: true,
        action: { key: actionKey },
        page: {
          key: pageKey,
          isActive: true,
          module: { key: moduleKey, isActive: true },
        },
      },
      select: { roleId: true },
    }),
    prisma.role.findMany({ where: { isSystem: true }, select: { id: true } }),
  ]);

  return Array.from(new Set([...grants.map((g) => g.roleId), ...systemRoles.map((r) => r.id)]));
}
