import { prisma } from "./prisma";

export interface AssetCostHistoryRow {
  id: string;
  transactionDate: Date;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
  description: string | null;
  glCode: string;
  glName: string;
  entityCode: string;
  invoiceId: string | null;
  invoiceNo: string | null;
  vendorName: string | null;
  status: string;
}

export interface AssetCostHistorySummary {
  totalAllTime: number;
  currentYear: number;
  byWindow: Record<string, number>;
  maintenanceCount: number;
  repairCount: number;
  transactionCount: number;
}

const DEFAULT_WINDOWS_DAYS = [30, 90, 120, 180, 365];

export async function getAssetCostHistory(
  assetId: string,
  opts: { windows?: number[]; limit?: number } = {},
): Promise<{ rows: AssetCostHistoryRow[]; summary: AssetCostHistorySummary }> {
  const windows = opts.windows ?? DEFAULT_WINDOWS_DAYS;
  const limit = opts.limit ?? 200;

  const transactions = await prisma.gLTransaction.findMany({
    where: { assetId, status: "POSTED" },
    orderBy: { transactionDate: "desc" },
    take: limit,
    include: {
      glAccount: { select: { code: true, name: true, category: true } },
      entity: { select: { code: true } },
      invoice: { select: { id: true, invoiceNo: true, vendorName: true, invoiceType: true } },
    },
  });

  const rows: AssetCostHistoryRow[] = transactions.map((t) => ({
    id: t.id,
    transactionDate: t.transactionDate,
    entryType: t.entryType,
    amount: Number(t.amount),
    description: t.description,
    glCode: t.glAccount.code,
    glName: t.glAccount.name,
    entityCode: t.entity.code,
    invoiceId: t.invoice?.id ?? null,
    invoiceNo: t.invoice?.invoiceNo ?? null,
    vendorName: t.invoice?.vendorName ?? null,
    status: t.status,
  }));

  const net = (list: AssetCostHistoryRow[]) =>
    list.reduce((s, r) => s + (r.entryType === "DEBIT" ? r.amount : -r.amount), 0);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const byWindow: Record<string, number> = {};
  for (const days of windows) {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    byWindow[String(days)] = net(rows.filter((r) => r.transactionDate >= cutoff));
  }

  const maintenanceCount = rows.filter((r) => /maintenance/i.test(r.glName)).length;
  const repairCount = rows.filter((r) => /repair/i.test(r.glName)).length;

  return {
    rows,
    summary: {
      totalAllTime: net(rows),
      currentYear: net(rows.filter((r) => r.transactionDate >= yearStart)),
      byWindow,
      maintenanceCount,
      repairCount,
      transactionCount: rows.length,
    },
  };
}

export async function checkDuplicateAssetExpense(params: {
  assetId: string;
  glAccountCode: string;
  transactionDate?: Date;
  windowDays?: number;
  excludeInvoiceId?: string;
}): Promise<{ isPotentialDuplicate: boolean; windowDays: number; matches: AssetCostHistoryRow[] }> {
  const windowDays = params.windowDays ?? 30;
  const asOf = params.transactionDate ?? new Date();
  const cutoff = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const matches = await prisma.gLTransaction.findMany({
    where: {
      assetId: params.assetId,
      status: "POSTED",
      entryType: "DEBIT",
      glAccount: { code: params.glAccountCode },
      transactionDate: { gte: cutoff, lte: asOf },
      ...(params.excludeInvoiceId ? { invoiceId: { not: params.excludeInvoiceId } } : {}),
    },
    orderBy: { transactionDate: "desc" },
    include: {
      glAccount: { select: { code: true, name: true } },
      entity: { select: { code: true } },
      invoice: { select: { id: true, invoiceNo: true, vendorName: true } },
    },
  });

  return {
    isPotentialDuplicate: matches.length > 0,
    windowDays,
    matches: matches.map((t) => ({
      id: t.id,
      transactionDate: t.transactionDate,
      entryType: t.entryType,
      amount: Number(t.amount),
      description: t.description,
      glCode: t.glAccount.code,
      glName: t.glAccount.name,
      entityCode: t.entity.code,
      invoiceId: t.invoice?.id ?? null,
      invoiceNo: t.invoice?.invoiceNo ?? null,
      vendorName: t.invoice?.vendorName ?? null,
      status: t.status,
    })),
  };
}
