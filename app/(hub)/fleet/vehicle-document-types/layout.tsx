import { requirePageAccess } from "@/lib/rbac";

export default async function FleetVehicleDocumentTypesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "vehicle-document-types", "view");
  return <>{children}</>;
}
