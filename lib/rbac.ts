import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentUser } from "./permissions";

export interface AccessiblePage {
  key: string;
  label: string;
  icon: string | null;
  href: string;
  sortOrder: number;
  actions: string[];
}

export interface AccessibleModule {
  key: string;
  label: string;
  icon: string | null;
  section: string | null;
  href: string | null;
  sortOrder: number;
  pages: AccessiblePage[];
}

export async function getGrantedActionsForModuleByRole(
  moduleKey: string,
  role: { id: string | null; isSystem: boolean } | null,
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (!role) return result;

  const mod = await prisma.permModule.findUnique({
    where: { key: moduleKey },
    include: { pages: { include: { actions: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!mod || !mod.isActive) return result;

  if (role.isSystem) {
    for (const page of mod.pages) {
      if (!page.isActive) continue;
      result.set(page.key, new Set(page.actions.map((a) => a.key)));
    }
    return result;
  }

  if (!role.id) return result;

  const grants = await prisma.rolePagePermission.findMany({
    where: { roleId: role.id, granted: true, page: { moduleId: mod.id, isActive: true } },
    include: { page: true, action: true },
  });

  for (const g of grants) {
    if (!result.has(g.page.key)) result.set(g.page.key, new Set());
    result.get(g.page.key)!.add(g.action.key);
  }
  return result;
}

async function getGrantedActionsForModule(moduleKey: string): Promise<Map<string, Set<string>>> {
  const user = await getCurrentUser();
  if (!user) return new Map();
  return getGrantedActionsForModuleByRole(moduleKey, { id: user.roleId, isSystem: user.isSystem });
}

export async function hasModuleAccess(moduleKey: string): Promise<boolean> {
  const sysUser = await getCurrentUser();
  if (sysUser?.isSystem) return true;
  const grants = await getGrantedActionsForModule(moduleKey);
  for (const actions of grants.values()) {
    if (actions.size > 0) return true;
  }
  return false;
}

export async function hasPageAccess(moduleKey: string, pageKey: string, action: string = "view"): Promise<boolean> {
  const sysUser = await getCurrentUser();
  if (sysUser?.isSystem) return true;
  const grants = await getGrantedActionsForModule(moduleKey);
  return grants.get(pageKey)?.has(action) ?? false;
}

export async function requirePageAccess(moduleKey: string, pageKey: string, action: string = "view") {
  const allowed = await hasPageAccess(moduleKey, pageKey, action);
  if (!allowed) redirect("/unauthorized");
}

export async function checkPageAccess(moduleKey: string, pageKey: string, action: string = "view"): Promise<boolean> {
  return hasPageAccess(moduleKey, pageKey, action);
}

export async function getAccessibleModuleByRole(
  moduleKey: string,
  role: { id: string | null; isSystem: boolean } | null,
): Promise<AccessibleModule | null> {
  const mod = await prisma.permModule.findUnique({
    where: { key: moduleKey },
    include: { pages: { include: { actions: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!mod || !mod.isActive) return null;

  const grants = await getGrantedActionsForModuleByRole(moduleKey, role);

  const pages: AccessiblePage[] = mod.pages
    .filter((p) => p.isActive && p.showInNav && grants.get(p.key)?.has("view"))
    .map((p) => ({
      key: p.key,
      label: p.label,
      icon: p.icon,
      href: p.href,
      sortOrder: p.sortOrder,
      actions: Array.from(grants.get(p.key) ?? []),
    }));

  if (pages.length === 0) return null;

  return {
    key: mod.key,
    label: mod.label,
    icon: mod.icon,
    section: mod.section,
    href: mod.href,
    sortOrder: mod.sortOrder,
    pages,
  };
}

export async function getAccessibleModule(moduleKey: string): Promise<AccessibleModule | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getAccessibleModuleByRole(moduleKey, { id: user.roleId, isSystem: user.isSystem });
}

export async function getAccessibleNavigation(): Promise<AccessibleModule[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const modules = await prisma.permModule.findMany({
    where: { isActive: true, key: { not: "dashboard" } },
    orderBy: { sortOrder: "asc" },
    select: { key: true },
  });

  const results = await Promise.all(
    modules.map((m) => getAccessibleModuleByRole(m.key, { id: user.roleId, isSystem: user.isSystem })),
  );
  return results.filter((m): m is AccessibleModule => m !== null);
}

export async function getUserLandingPage(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "/login";

  if (user.isSystem) return "/dashboard";

  if (user.defaultLandingPath) {
    const reachable = await isPathAccessible(user.defaultLandingPath);
    if (reachable) return user.defaultLandingPath;
  }

  if (await hasPageAccess("dashboard", "overview", "view")) return "/dashboard";

  const modules = await prisma.permModule.findMany({
    where: { isActive: true, key: { not: "dashboard" } },
    orderBy: { sortOrder: "asc" },
    select: { key: true },
  });
  for (const { key: moduleKey } of modules) {
    const mod = await getAccessibleModule(moduleKey);
    if (!mod || mod.pages.length === 0) continue;

    const dashboardPage = mod.pages.find((p) => p.key === "dashboard");
    if (dashboardPage) return dashboardPage.href;

    const first = [...mod.pages].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return first.href;
  }

  return "/no-access";
}

async function isPathAccessible(href: string): Promise<boolean> {
  const page = await prisma.permPage.findFirst({ where: { href } });
  if (!page) return true;
  const mod = await prisma.permModule.findUnique({ where: { id: page.moduleId } });
  if (!mod) return true;
  return hasPageAccess(mod.key, page.key, "view");
}
