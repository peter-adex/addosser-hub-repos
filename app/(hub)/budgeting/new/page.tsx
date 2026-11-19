import { Metadata } from "next";
<<<<<<< HEAD
import { requireGranularPermission, requireAuth } from "@/lib/permissions";
=======
import { requirePermission, requireAuth } from "@/lib/permissions";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
import { prisma } from "@/lib/prisma";
import NewBudgetForm from "@/components/budgeting/NewBudgetForm";

export const metadata: Metadata = { title: "New Budget Line" };

export default async function NewBudgetPage() {
<<<<<<< HEAD
  await requireGranularPermission("budgeting", "budgets", "create");
  const user = await requireAuth();

  const [entities, glAccounts] = await Promise.all([
    prisma.entity.findMany({
      where: { isActive: true, ...(user.isSystem ? {} : { id: user.entityId }) },
      orderBy: { code: "asc" },
    }),
    prisma.gLAccount.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
=======
  await requirePermission("budgeting", "canCreate");
  const user = await requireAuth();

  const [entities, glAccounts] = await Promise.all([
    prisma.entity.findMany({ where: { isActive: true, ...(user.isSystem ? {} : { id: user.entityId }) }, orderBy: { code: "asc" } }),
    prisma.gLAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">New Budget Line</h1>
<<<<<<< HEAD
        <p className="text-muted-foreground text-sm mt-1">
          Create an OPEX or CAPEX budget for an entity — linked to a GL account and optionally a specific branch.
        </p>
=======
        <p className="text-muted-foreground text-sm mt-1">Create a new GL account budget for an entity</p>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      </div>
      <NewBudgetForm entities={entities} glAccounts={glAccounts} />
    </div>
  );
}
