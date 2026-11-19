import type { InvoiceCategoryType } from "@prisma/client";

export const INVOICE_TYPE_LABELS: Record<InvoiceCategoryType, string> = {
  GENERAL_EXPENSE: "General Expense",
  ASSET_RELATED: "Asset-Related",
  ASSET_PURCHASE: "Asset Purchase",
  FLEET_FUEL: "Fleet Fuel",
};

export function invoiceTypeLabel(type: string): string {
  return INVOICE_TYPE_LABELS[type as InvoiceCategoryType] ?? type.replace(/_/g, " ");
}

export const INVOICE_TYPE_BADGE_CLASS: Record<InvoiceCategoryType, string> = {
  GENERAL_EXPENSE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ASSET_RELATED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  ASSET_PURCHASE: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  FLEET_FUEL: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};
