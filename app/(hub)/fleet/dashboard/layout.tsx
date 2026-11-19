import { requirePageAccess } from "@/lib/rbac";

export default async function FleetDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "dashboard", "view");
  return <>{children}</>;
}
