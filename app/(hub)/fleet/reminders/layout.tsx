import { requirePageAccess } from "@/lib/rbac";

export default async function FleetRemindersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("fleet", "reminders", "view");
  return <>{children}</>;
}
