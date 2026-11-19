import { Metadata }                        from "next";
import Link                                from "next/link";
import { notFound }                        from "next/navigation";
import { requireGranularPermission, requireAuth }  from "@/lib/permissions";
import { prisma }                          from "@/lib/prisma";
import AssetForm                           from "@/components/assets/AssetForm";

export const metadata: Metadata = { title: "Edit Asset" };

export default async function AssetEditPage({ params }: { params: { id: string } }) {
  await requireGranularPermission("assets", "edit", "edit");
  const user = await requireAuth();

  const [asset, entities, glAccounts, users, classifications] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: params.id },
      include: {
        entity:   { select: { name: true, code: true } },
        branch:   { select: { name: true } },
      },
    }),
    prisma.entity.findMany({
      where:   { isActive: true, ...(user.isSystem ? {} : { id: user.entityId }) },
      include: { branches: { where: { isActive: true }, orderBy: { name: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.gLAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where:   { isActive: true, ...(user.isSystem ? {} : { entityId: user.entityId }) },
      select:  { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.assetClassification.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!asset) notFound();
  if (!user.isSystem && asset.entityId !== user.entityId) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets" className="hover:text-foreground">Assets</Link>
        <span>/</span>
        <Link href={`/assets/${asset.id}`} className="hover:text-foreground">{asset.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Edit Asset</h1>
        <p className="text-muted-foreground text-sm mt-1">{asset.assetNo} — {asset.entity.name}</p>
      </div>

      <AssetForm
        entities={entities as any}
        glAccounts={glAccounts}
        users={users}
        classifications={classifications as any}
        asset={asset as any}
      />
    </div>
  );
}
