import { Metadata }                       from "next";
import { requireGranularPermission, requireAuth } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import AssetForm                          from "@/components/assets/AssetForm";

export const metadata: Metadata = { title: "Register Asset" };

export default async function NewAssetPage() {
  await requireGranularPermission("assets", "register", "create");
  const user = await requireAuth();

  const [entities, glAccounts, users, classifications] = await Promise.all([
    prisma.entity.findMany({
      where: { isActive: true, ...(user.isSystem ? {} : { id: user.entityId }) },
      include: { branches: { where: { isActive: true }, orderBy: { name: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.gLAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.assetClassification.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Register New Asset</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Complete all required fields. The asset will enter an approval workflow before becoming active.
        </p>
      </div>

      <AssetForm
        entities={entities as any}
        glAccounts={glAccounts}
        users={users}
        classifications={classifications as any}
      />
    </div>
  );
}
