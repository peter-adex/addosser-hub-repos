import { Metadata }                       from "next";
import { requireAuth }                    from "@/lib/permissions";
import { redirect }                       from "next/navigation";
import { prisma }                         from "@/lib/prisma";
import AssetClassificationsClient        from "@/components/assets/AssetClassificationsClient";

export const metadata: Metadata = { title: "Asset Classifications" };

export default async function AssetClassificationsPage() {
  const user = await requireAuth();
  if (!user.isSystem && user.roleName !== "Super Admin") redirect("/assets");

  const [classifications, glAccounts] = await Promise.all([
    prisma.assetClassification.findMany({
      include: { _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.gLAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Asset Classifications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define asset categories with default depreciation settings. These populate automatically when registering assets.
        </p>
      </div>
      <AssetClassificationsClient classifications={classifications as any} glAccounts={glAccounts} />
    </div>
  );
}
