import { requirePageAccess } from "@/lib/rbac";

export default async function FleetVehicleDocumentRegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "vehicle-document-register", "view");
  return <>{children}</>;
}
