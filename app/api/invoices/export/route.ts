import { NextRequest, NextResponse }   from "next/server";
import { getServerSession }            from "next-auth";
import { authOptions }                 from "@/lib/auth";
import { prisma }                      from "@/lib/prisma";
import { hasGranularPermission }       from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ALL_FIELDS = [
  "invoiceNo", "vendorName", "vendorCode", "vendorEmail",
  "entityCode", "entityName", "branchName",
  "glAccountCode", "description",
  "subtotal", "vatAmount", "whtAmount", "totalAmount", "amountPayable",
  "status", "approvalStatus",
  "isBudgetExceeded", "exceedanceAmount", "isExceptionalApproval",
  "dueDate", "paidAt", "paymentRef",
  "submittedBy", "submittedByEmail",
  "createdAt", "updatedAt",
];

const DEFAULT_FIELDS = [
  "invoiceNo", "vendorName", "entityCode", "glAccountCode",
  "subtotal", "vatAmount", "whtAmount", "totalAmount", "amountPayable",
  "status", "dueDate", "paidAt", "isBudgetExceeded", "isExceptionalApproval",
  "createdAt",
];

function escapeCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasGranularPermission("invoice", "reports", "view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityId  = searchParams.get("entityId")  ?? undefined;
  const status    = searchParams.get("status")     ?? undefined;
  const dateFrom  = searchParams.get("dateFrom")   ?? undefined;
  const dateTo    = searchParams.get("dateTo")     ?? undefined;
  const rawFields = searchParams.get("fields");

  const selectedFields = rawFields
    ? rawFields.split(",").filter((f) => ALL_FIELDS.includes(f))
    : DEFAULT_FIELDS;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(status   ? { status: status as any } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59)) } : {}),
        },
      } : {}),
    },
    include: {
      entity:      { select: { name: true, code: true } },
      vendor:      { select: { name: true, code: true, email: true } },
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = selectedFields;
  const rows: string[][] = [];

  for (const inv of invoices) {
    const row: string[] = [];
    for (const field of selectedFields) {
      let value: unknown;
      switch (field) {
        case "invoiceNo":              value = inv.invoiceNo; break;
        case "vendorName":             value = inv.vendor?.name ?? inv.vendorName; break;
        case "vendorCode":             value = inv.vendor?.code ?? ""; break;
        case "vendorEmail":            value = inv.vendor?.email ?? inv.vendorEmail; break;
        case "entityCode":             value = inv.entity.code; break;
        case "entityName":             value = inv.entity.name; break;
        case "branchName":             value = (inv as any).branch?.name ?? ""; break;
        case "glAccountCode":          value = inv.glAccountCode; break;
        case "description":            value = inv.description; break;
        case "subtotal":               value = Number(inv.subtotal).toFixed(2); break;
        case "vatAmount":              value = Number(inv.vatAmount).toFixed(2); break;
        case "whtAmount":              value = Number(inv.whtAmount).toFixed(2); break;
        case "totalAmount":            value = Number(inv.totalAmount).toFixed(2); break;
        case "amountPayable":          value = Number(inv.amountPayable).toFixed(2); break;
        case "status":                 value = inv.status; break;
        case "approvalStatus":         value = inv.approvalStatus ?? ""; break;
        case "isBudgetExceeded":       value = inv.isBudgetExceeded ? "Yes" : "No"; break;
        case "exceedanceAmount":       value = inv.exceedanceAmount ? Number(inv.exceedanceAmount).toFixed(2) : ""; break;
        case "isExceptionalApproval":  value = inv.isExceptionalApproval ? "Yes" : "No"; break;
        case "dueDate":                value = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-NG") : ""; break;
        case "paidAt":                 value = inv.paidAt  ? new Date(inv.paidAt).toLocaleDateString("en-NG")  : ""; break;
        case "paymentRef":             value = inv.paymentRef ?? ""; break;
        case "submittedBy":            value = inv.submittedBy.name; break;
        case "submittedByEmail":       value = inv.submittedBy.email; break;
        case "createdAt":              value = new Date(inv.createdAt).toLocaleDateString("en-NG"); break;
        case "updatedAt":              value = new Date(inv.updatedAt).toLocaleDateString("en-NG"); break;
        default:                       value = "";
      }
      row.push(escapeCsv(value));
    }
    rows.push(row);
  }

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename  = `invoices-export-${timestamp}.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
