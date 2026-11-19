import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALL_COLUMNS = [
  "entity","vendorName","invoiceNo","description","paymentDate",
  "subtotal","vat","wht","amountPayable","trancheLabel",
  "amountPaid","paymentRef","paymentMethod","status",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const user = session.user as any;
    const perm = await getPaymentCaps(user);
    if (!perm.view('history') && !user.isSystem) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const sp = req.nextUrl.searchParams;
    const requestedCols = sp.getAll("columns") as ColKey[];
    const columns: ColKey[] = requestedCols.length > 0
      ? ALL_COLUMNS.filter((c) => requestedCols.includes(c))
      : [...ALL_COLUMNS];

    const allowedEntityIds: string[] = user.isSystem
      ? []
      : user.allowedEntityIds ?? [user.entityId];

    const entityFilter = sp.get("entity") || undefined;

    const where: Prisma.PaymentTrancheWhereInput = {
      paymentBatch: {
        ...(entityFilter ? { entityId: entityFilter } : !user.isSystem ? { entityId: { in: allowedEntityIds } } : {}),
        invoice: {
          ...(sp.get("vendor") ? { OR: [{ vendorName: { contains: sp.get("vendor")! } }, { vendor: { name: { contains: sp.get("vendor")! } } }] } : {}),
          ...(sp.get("invoiceNo") ? { invoiceNo: { contains: sp.get("invoiceNo")! } } : {}),
          ...(sp.get("description") ? { description: { contains: sp.get("description")! } } : {}),
        },
      },
      ...(sp.get("paymentRef") ? { transactionRef: { contains: sp.get("paymentRef")! } } : {}),
      ...(sp.get("status") ? { status: sp.get("status") as any } : {}),
      ...(sp.get("dateFrom") || sp.get("dateTo") ? { paidAt: { ...(sp.get("dateFrom") ? { gte: new Date(sp.get("dateFrom")!) } : {}), ...(sp.get("dateTo") ? { lte: new Date(sp.get("dateTo")!) } : {}) } } : {}),
    };

    const tranches = await prisma.paymentTranche.findMany({
      where,
      take: 5000,
      orderBy: { paidAt: "desc" },
      include: {
        paymentBatch: {
          include: {
            entity: { select: { name: true } },
            invoice: { include: { vendor: { select: { name: true } } } },
          },
        },
      },
    });

    const rows = tranches.map((t) => {
      const inv = t.paymentBatch.invoice;
      const row: Record<string, string | number> = {};
      if (columns.includes("entity"))       row["Entity"]             = t.paymentBatch.entity.name;
      if (columns.includes("vendorName"))   row["Vendor Name"]        = inv.vendor?.name ?? inv.vendorName;
      if (columns.includes("invoiceNo"))    row["Invoice Number"]     = inv.invoiceNo;
      if (columns.includes("description"))  row["Description"]        = inv.description ?? "";
      if (columns.includes("paymentDate"))  row["Payment Date"]       = t.paidAt ? t.paidAt.toLocaleDateString("en-NG") : "";
      if (columns.includes("subtotal"))     row["Sub-Total (₦)"]      = Number(inv.subtotal);
      if (columns.includes("vat"))          row["VAT (₦)"]            = Number(inv.vatAmount);
      if (columns.includes("wht"))          row["WHT (₦)"]            = Number(inv.whtAmount);
      if (columns.includes("amountPayable"))row["Amount Payable (₦)"] = Number(inv.amountPayable);
      if (columns.includes("trancheLabel")) row["Payment Tranche"]    = t.label ?? `Tranche ${t.trancheNumber}`;
      if (columns.includes("amountPaid"))   row["Amount Paid (₦)"]    = Number(t.plannedAmount);
      if (columns.includes("paymentRef"))   row["Payment Reference"]  = t.transactionRef ?? "";
      if (columns.includes("paymentMethod"))row["Payment Method"]     = t.paymentMethod ?? "";
      if (columns.includes("status"))       row["Status"]             = t.status;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payment History");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `payment-history-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/payment/history/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
