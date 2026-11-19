"use client";

import { useState } from "react";
import VendorExportModal from "./VendorExportModal";

interface Props {
  filters: { search?: string; status?: string; entityId?: string };
}

export default function VendorExportButton({ filters }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-card text-foreground hover:bg-accent"
      >
        📤 Export
      </button>
      <VendorExportModal open={open} onClose={() => setOpen(false)} filters={filters} />
    </>
  );
}
