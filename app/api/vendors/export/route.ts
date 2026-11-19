import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const ALL_VENDOR_COLUMNS = [
  "code", "name", "entity", "email", "phone", "address", "website",
  "taxId", "rcNumber",
  "contactPerson", "contactEmail", "contactPhone",
  "bankName", "bankAccountNo", "bankAccountName", "bankSortCode",
  "city", "state", "country",
  "isActive", "isApproved", "notes",
  "createdBy", "createdAt",
] as const;

type ColKey = (typeof ALL_VENDOR_COLUMNS)[number];

const COLUMN_LABELS: Record<ColKey, string> = {
  code: "Vendor Code", name: "Vendor Name", entity: "Entity",
  email: "Email", phone: "Phone", address: "Address", website: "Website",
  taxId: "Tax ID (VAT/TIN)", rcNumber: "RC Number",
  contactPerson: "Contact Person", contactEmail: "Contact Email", contactPhone: "Contact Phone",
  bankName: "Bank Name", bankAccountNo: "Bank Account No.",
  bankAccountName: "Bank Account Name", bankSortCode: "Bank Sort Code",
  city: "City", state: "State", country: "Country",
  isActive: "Status", isApproved: "Admin-Approved", notes: "Notes",
  createdBy: "Added By", createdAt: "Added On",
};

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-NG") : "";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canView = await hasGranularPermission("vendor", "list", "export");
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const requestedCols = sp.getAll("columns") as ColKey[];
    const columns: ColKey[] = requestedCols.length > 0
      ? ALL_VENDOR_COLUMNS.filter((c) => requestedCols.includes(c))
      : [...ALL_VENDOR_COLUMNS];

    const search = sp.get("search") || undefined;
    const status = sp.get("status") || undefined;
    const entityId = sp.get("entityId") || undefined;

    const where: any = {
      ...(entityId && entityId !== "ALL" ? { entityId } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(status === "approved" ? { isApproved: true } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
          { email: { contains: search } },
        ],
      } : {}),
    };

    const vendors = await prisma.vendor.findMany({
      where,
      take: 5000,
      orderBy: { name: "asc" },
      include: {
        entity: { select: { name: true, code: true } },
        createdBy: { select: { name: true } },
      },
    });

    const rows = vendors.map((v) => {
      const row: Record<string, string> = {};
      if (columns.includes("code")) row[COLUMN_LABELS.code] = v.code ?? "";
      if (columns.includes("name")) row[COLUMN_LABELS.name] = v.name;
      if (columns.includes("entity")) row[COLUMN_LABELS.entity] = v.entity ? `${v.entity.name} (${v.entity.code})` : "Global";
      if (columns.includes("email")) row[COLUMN_LABELS.email] = v.email ?? "";
      if (columns.includes("phone")) row[COLUMN_LABELS.phone] = v.phone ?? "";
      if (columns.includes("address")) row[COLUMN_LABELS.address] = v.address ?? "";
      if (columns.includes("website")) row[COLUMN_LABELS.website] = v.website ?? "";
      if (columns.includes("taxId")) row[COLUMN_LABELS.taxId] = v.taxId ?? "";
      if (columns.includes("rcNumber")) row[COLUMN_LABELS.rcNumber] = v.rcNumber ?? "";
      if (columns.includes("contactPerson")) row[COLUMN_LABELS.contactPerson] = v.contactPerson ?? "";
      if (columns.includes("contactEmail")) row[COLUMN_LABELS.contactEmail] = v.contactEmail ?? "";
      if (columns.includes("contactPhone")) row[COLUMN_LABELS.contactPhone] = v.contactPhone ?? "";
      if (columns.includes("bankName")) row[COLUMN_LABELS.bankName] = v.bankName ?? "";
      if (columns.includes("bankAccountNo")) row[COLUMN_LABELS.bankAccountNo] = v.bankAccountNo ?? "";
      if (columns.includes("bankAccountName")) row[COLUMN_LABELS.bankAccountName] = v.bankAccountName ?? "";
      if (columns.includes("bankSortCode")) row[COLUMN_LABELS.bankSortCode] = v.bankSortCode ?? "";
      if (columns.includes("city")) row[COLUMN_LABELS.city] = v.city ?? "";
      if (columns.includes("state")) row[COLUMN_LABELS.state] = v.state ?? "";
      if (columns.includes("country")) row[COLUMN_LABELS.country] = v.country ?? "";
      if (columns.includes("isActive")) row[COLUMN_LABELS.isActive] = v.isActive ? "Active" : "Disabled";
      if (columns.includes("isApproved")) row[COLUMN_LABELS.isApproved] = v.isApproved ? "Yes" : "No";
      if (columns.includes("notes")) row[COLUMN_LABELS.notes] = v.notes ?? "";
      if (columns.includes("createdBy")) row[COLUMN_LABELS.createdBy] = v.createdBy?.name ?? "";
      if (columns.includes("createdAt")) row[COLUMN_LABELS.createdAt] = fmtDate(v.createdAt);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendors");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `vendor-list-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/vendors/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
