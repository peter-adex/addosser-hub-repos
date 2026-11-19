"use client";

import { useState } from "react";
import AssetExportModal from "./AssetExportModal";

interface Props {
  filters: { q?: string; status?: string; approval?: string; entity?: string; branch?: string };
}

export default function AssetExportButton({ filters }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-card text-foreground hover:bg-accent"
      >
        📤 Export
      </button>
      <AssetExportModal open={open} onClose={() => setOpen(false)} filters={filters} />
    </>
  );
}
