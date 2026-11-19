import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvEscape(v: string): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const user = session.user as any;

  const perm = await getPaymentCaps(user);
  if (!perm.view() && !user.isSystem) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const batch = await prisma.paymentBatch.findUnique({
    where: { id: params.batchId },
    include: {
      invoice: {
        include: {
          vendor: true,
          entity: { select: { name: true } },
          glAccount: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Payment batch not found" }, { status: 404 });
  }

  const inv = batch.invoice;
  const v = inv.vendor;

  const glAccountDisplay = inv.glAccount
    ? `${inv.glAccount.code} — ${inv.glAccount.name}`
    : inv.glAccountCode && !inv.glAccountCode.startsWith("cm")
      ? inv.glAccountCode
      : "—";

  const subtotal    = Number(inv.subtotal).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const vatAmt      = Number(inv.vatAmount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const totalVat    = Number(inv.totalAmount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const whtAmt      = Number(inv.whtAmount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const payable     = Number(inv.amountPayable).toLocaleString("en-NG", { minimumFractionDigits: 2 });

  const headers = [
    "Invoice No", "Entity", "Vendor Name",
    "Bank Name", "Bank Account No", "Bank Account Name",
    "TIN (Tax ID)", "RC Number",
    "Sub-Total (₦)", "VAT (₦)", "Total + VAT (₦)",
    "WHT (₦)", "Amount Payable (₦)",
    "GL Account", "Description",
  ];

  const row = [
    inv.invoiceNo,
    inv.entity.name,
    v?.name ?? inv.vendorName,
    v?.bankName ?? "",
    v?.bankAccountNo ?? "",
    v?.bankAccountName ?? "",
    v?.taxId ?? "",
    v?.rcNumber ?? "",
    subtotal,
    vatAmt,
    totalVat,
    whtAmt,
    payable,
    glAccountDisplay,
    inv.description ?? "",
  ];

  const csv = [
    headers.map(csvEscape).join(","),
    row.map(csvEscape).join(","),
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoice-${inv.invoiceNo}-vendor-details.csv"`,
    },
  });
}
