export const PENDING_FIELD_LABELS: Record<string, string> = {
  entityId:           "Entity",
  branchId:           "Branch",
  name:               "Asset Name",
  description:        "Description",
  classificationId:   "Classification",
  legacyCategory:     "Category",
  barcodeTag:         "Asset Tag",
  serialNo:           "Serial Number",
  make:               "Make",
  model:              "Model",
  tags:               "Tags",
  isMovable:          "Movable",
  purchaseDate:       "Purchase Date",
  acquisitionValue:   "Acquisition Value",
  residualValue:      "Residual Value",
  currentBookValue:   "Current Book Value",
  usefulLifeYrs:      "Useful Life (years)",
  depreciationMethod: "Depreciation Method",
  supplier:           "Supplier / Vendor",
  invoiceRef:         "Invoice Reference No.",
  warrantyExpiry:     "Warranty Expiry",
  insuranceExpiry:    "Insurance Expiry",
  glAccountCode:      "GL Account Code",
  glAccountId:        "GL Account",
  budgetRef:          "Budget Reference",
  photos:             "Photos",
};

const RELATION_ID_FIELDS = new Set(["entityId", "branchId", "classificationId", "glAccountId"]);

const CURRENCY_FIELDS = new Set(["acquisitionValue", "residualValue", "currentBookValue"]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function formatPendingFieldValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === "") return "—";

  if (field && RELATION_ID_FIELDS.has(field)) return "(changed)";

  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") {
    if (field && CURRENCY_FIELDS.has(field)) {
      return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toLocaleString("en-NG");
  }

  if (typeof value === "string") {
    if (ISO_DATE_RE.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleDateString("en-NG");
    }
    return value;
  }

  return String(value);
}
