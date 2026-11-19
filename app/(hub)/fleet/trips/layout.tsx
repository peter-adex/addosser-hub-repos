import { requirePageAccess } from "@/lib/rbac";

export default async function FleetTripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "trips", "view");
  return <>{children}</>;
}
