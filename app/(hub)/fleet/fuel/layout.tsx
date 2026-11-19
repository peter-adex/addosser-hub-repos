import { requirePageAccess } from "@/lib/rbac";

export default async function FleetFuelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "fuel", "view");
  return <>{children}</>;
}
