import { requirePageAccess } from "@/lib/rbac";

export default async function FleetDriversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "drivers", "view");
  return <>{children}</>;
}
