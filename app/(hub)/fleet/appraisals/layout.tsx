import { requirePageAccess } from "@/lib/rbac";

export default async function FleetAppraisalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "appraisals", "view");
  return <>{children}</>;
}
