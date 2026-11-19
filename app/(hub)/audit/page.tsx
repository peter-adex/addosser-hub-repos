import { Metadata }                    from "next";
import { redirect }                    from "next/navigation";
import { requireAuth }                 from "@/lib/permissions";
import AuditTrailClient                from "@/components/audit/AuditTrailClient";

export const metadata: Metadata = { title: "Audit Trail" };

export default async function AuditPage() {
  const user = await requireAuth();

  if (!user.isSystem && user.roleName !== "Super Admin") {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Audit Trail</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Complete record of every action performed — user, timestamp, IP address and before/after data.
        </p>
      </div>

      <AuditTrailClient />
    </div>
  );
}
