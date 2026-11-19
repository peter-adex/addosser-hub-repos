import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const ALL_ASSET_COLUMNS = [
  "assetNo", "barcodeTag", "serialNo", "name", "description",
  "classification", "legacyCategory", "make", "model",
  "entity", "branch", "location", "isMovable",
  "acquisitionValue", "residualValue", "currentBookValue", "purchaseDate",
  "usefulLifeYrs", "depreciationMethod", "lastDepreciationDate",
  "condition", "status", "approvalStatus",
  "supplier", "invoiceRef", "warrantyExpiry", "insuranceExpiry",
  "glAccountCode", "budgetRef",
  "tags", "assignedTo", "createdBy", "createdAt", "updatedAt",
] as const;

type ColKey = (typeof ALL_ASSET_COLUMNS)[number];

const COLUMN_LABELS: Record<ColKey, string> = {
  assetNo: "Asset No.", barcodeTag: "Barcode Tag", serialNo: "Serial No.",
  name: "Asset Name", description: "Description",
  classification: "Classification", legacyCategory: "Legacy Category",
  make: "Make", model: "Model",
  entity: "Entity", branch: "Branch", location: "Location", isMovable: "Movable",
  acquisitionValue: "Acquisition Value (₦)", residualValue: "Residual Value (₦)",
  currentBookValue: "Current Book Value (₦)", purchaseDate: "Purchase Date",
  usefulLifeYrs: "Useful Life (Yrs)", depreciationMethod: "Depreciation Method",
  lastDepreciationDate: "Last Depreciation Date",
  condition: "Condition", status: "Status", approvalStatus: "Approval Status",
  supplier: "Supplier", invoiceRef: "Invoice Ref.",
  warrantyExpiry: "Warranty Expiry", insuranceExpiry: "Insurance Expiry",
  glAccountCode: "GL Account", budgetRef: "Linked CAPEX Budget ID",
  tags: "Tags", assignedTo: "Assigned To", createdBy: "Registered By",
  createdAt: "Registered On", updatedAt: "Last Updated",
};

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-NG") : "";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!(user.isSystem || (await hasGranularPermission("assets", "assets", "export")))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;

    const requestedCols = sp.getAll("columns") as ColKey[];
    const columns: ColKey[] = requestedCols.length > 0
      ? ALL_ASSET_COLUMNS.filter((c) => requestedCols.includes(c))
      : [...ALL_ASSET_COLUMNS];

    const entityFilter = user.isSystem ? (sp.get("entity") || undefined) : user.entityId;
    const q = sp.get("q") || undefined;

    const where: any = {
      ...(entityFilter ? { entityId: entityFilter } : {}),
      ...(sp.get("branch") ? { branchId: sp.get("branch") } : {}),
      ...(sp.get("status") ? { status: sp.get("status") } : {}),
      ...(sp.get("approval") ? { approvalStatus: sp.get("approval") } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q } },
          { assetNo: { contains: q } },
          { serialNo: { contains: q } },
        ],
      } : {}),
    };

    const assets = await prisma.asset.findMany({
      where,
      take: 5000,
      orderBy: { createdAt: "desc" },
      include: {
        entity: { select: { name: true, code: true } },
        branch: { select: { name: true, code: true } },
        classification: { select: { name: true } },
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    const rows = assets.map((a) => {
      const row: Record<string, string | number> = {};
      if (columns.includes("assetNo")) row[COLUMN_LABELS.assetNo] = a.assetNo;
      if (columns.includes("barcodeTag")) row[COLUMN_LABELS.barcodeTag] = a.barcodeTag ?? "";
      if (columns.includes("serialNo")) row[COLUMN_LABELS.serialNo] = a.serialNo ?? "";
      if (columns.includes("name")) row[COLUMN_LABELS.name] = a.name;
      if (columns.includes("description")) row[COLUMN_LABELS.description] = a.description ?? "";
      if (columns.includes("classification")) row[COLUMN_LABELS.classification] = a.classification?.name ?? a.legacyCategory ?? "";
      if (columns.includes("legacyCategory")) row[COLUMN_LABELS.legacyCategory] = a.legacyCategory ?? "";
      if (columns.includes("make")) row[COLUMN_LABELS.make] = a.make ?? "";
      if (columns.includes("model")) row[COLUMN_LABELS.model] = a.model ?? "";
      if (columns.includes("entity")) row[COLUMN_LABELS.entity] = `${a.entity.name} (${a.entity.code})`;
      if (columns.includes("branch")) row[COLUMN_LABELS.branch] = a.branch.name;
      if (columns.includes("location")) row[COLUMN_LABELS.location] = a.location ?? "";
      if (columns.includes("isMovable")) row[COLUMN_LABELS.isMovable] = a.isMovable ? "Yes" : "No";
      if (columns.includes("acquisitionValue")) row[COLUMN_LABELS.acquisitionValue] = Number(a.acquisitionValue ?? 0);
      if (columns.includes("residualValue")) row[COLUMN_LABELS.residualValue] = Number(a.residualValue ?? 0);
      if (columns.includes("currentBookValue")) row[COLUMN_LABELS.currentBookValue] = Number(a.currentBookValue ?? 0);
      if (columns.includes("purchaseDate")) row[COLUMN_LABELS.purchaseDate] = fmtDate(a.purchaseDate);
      if (columns.includes("usefulLifeYrs")) row[COLUMN_LABELS.usefulLifeYrs] = a.usefulLifeYrs;
      if (columns.includes("depreciationMethod")) row[COLUMN_LABELS.depreciationMethod] = a.depreciationMethod;
      if (columns.includes("lastDepreciationDate")) row[COLUMN_LABELS.lastDepreciationDate] = fmtDate(a.lastDepreciationDate);
      if (columns.includes("condition")) row[COLUMN_LABELS.condition] = a.condition;
      if (columns.includes("status")) row[COLUMN_LABELS.status] = a.status;
      if (columns.includes("approvalStatus")) row[COLUMN_LABELS.approvalStatus] = a.approvalStatus;
      if (columns.includes("supplier")) row[COLUMN_LABELS.supplier] = a.supplier ?? "";
      if (columns.includes("invoiceRef")) row[COLUMN_LABELS.invoiceRef] = a.invoiceRef ?? "";
      if (columns.includes("warrantyExpiry")) row[COLUMN_LABELS.warrantyExpiry] = fmtDate(a.warrantyExpiry);
      if (columns.includes("insuranceExpiry")) row[COLUMN_LABELS.insuranceExpiry] = fmtDate(a.insuranceExpiry);
      if (columns.includes("glAccountCode")) row[COLUMN_LABELS.glAccountCode] = a.glAccountCode ?? "";
      if (columns.includes("budgetRef")) row[COLUMN_LABELS.budgetRef] = a.budgetRef ?? "";
      if (columns.includes("tags")) row[COLUMN_LABELS.tags] = a.tags ?? "";
      if (columns.includes("assignedTo")) row[COLUMN_LABELS.assignedTo] = a.assignedTo?.name ?? "";
      if (columns.includes("createdBy")) row[COLUMN_LABELS.createdBy] = a.createdBy?.name ?? "";
      if (columns.includes("createdAt")) row[COLUMN_LABELS.createdAt] = fmtDate(a.createdAt);
      if (columns.includes("updatedAt")) row[COLUMN_LABELS.updatedAt] = fmtDate(a.updatedAt);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asset Register");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/assets/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
