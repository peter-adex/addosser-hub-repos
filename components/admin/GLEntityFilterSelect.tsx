"use client";

import { useRouter } from "next/navigation";

interface EntityOpt { id: string; code: string; name: string; }

export default function GLEntityFilterSelect({
  glAccountId,
  entities,
  currentEntityId,
}: {
  glAccountId: string;
  entities: EntityOpt[];
  currentEntityId?: string;
}) {
  const router = useRouter();

  if (entities.length <= 1) return null;

  return (
    <select
      value={currentEntityId ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        router.push(`/admin/gl-accounts/${glAccountId}${val ? `?entityId=${val}` : ""}`);
      }}
      className="px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm"
    >
      <option value="">All Entities</option>
      {entities.map((e) => (
        <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
      ))}
    </select>
  );
}
