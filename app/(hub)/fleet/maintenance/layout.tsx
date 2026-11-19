import { requirePageAccess } from "@/lib/rbac";

export default async function FleetMaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "maintenance", "view");
  return <>{children}</>;
}
