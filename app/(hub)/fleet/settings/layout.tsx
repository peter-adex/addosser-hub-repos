import { requirePageAccess } from "@/lib/rbac";

export default async function FleetSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "fleet-settings", "view");
  return <>{children}</>;
}
