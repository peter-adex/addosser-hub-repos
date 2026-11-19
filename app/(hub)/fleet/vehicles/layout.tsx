import { requirePageAccess } from "@/lib/rbac";

export default async function FleetVehiclesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "vehicles", "view");
  return <>{children}</>;
}
