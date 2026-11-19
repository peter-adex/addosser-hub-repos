import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface PostingResult {
  assetId: string;
  posted: boolean;
  reason?: string;
  depreciationAmt?: number;
  closingValue?: number;
}

export async function postDepreciationForAsset(
  assetId: string,
  year: number,
  month: number,
  postingDate: Date = new Date(),
): Promise<PostingResult> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { assetId, posted: false, reason: "Asset not found" };

  if (asset.status !== "ACTIVE") {
    return { assetId, posted: false, reason: `Asset status is ${asset.status}, not depreciable` };
  }
  if (asset.depreciationMethod === "NONE") {
    return { assetId, posted: false, reason: "Depreciation method is NONE" };
  }
  if (!asset.acquisitionValue || !asset.purchaseDate) {
    return { assetId, posted: false, reason: "Missing acquisitionValue or purchaseDate" };
  }

  const existing = await prisma.assetDepreciation.findUnique({
    where: { assetId_year_month: { assetId, year, month } },
  });
  if (existing) {
    return { assetId, posted: false, reason: "Already posted for this period" };
  }

  const acqVal      = Number(asset.acquisitionValue);
  const resVal      = Number(asset.residualValue ?? 0);
  const depreciable = Math.max(0, acqVal - resVal);
  const usefulLifeYrs = asset.usefulLifeYrs || 4;
  const totalLifeMonths = usefulLifeYrs * 12;
  if (totalLifeMonths <= 0 || depreciable <= 0) {
    return { assetId, posted: false, reason: "Nothing left to depreciate" };
  }

  const openingValue = asset.currentBookValue != null ? Number(asset.currentBookValue) : acqVal;
  const alreadyAccumulated = acqVal - openingValue;

  if (alreadyAccumulated >= depreciable) {
    return { assetId, posted: false, reason: "Already fully depreciated" };
  }

  const monthlyCharge = depreciable / totalLifeMonths;
  const charge   = Math.min(monthlyCharge, openingValue - resVal);
  const closing  = Math.max(resVal, openingValue - charge);
  const rate     = depreciable > 0 ? monthlyCharge / depreciable : 0;

  await prisma.$transaction([
    prisma.assetDepreciation.create({
      data: {
        assetId, year, month,
        openingValue: openingValue as unknown as Prisma.Decimal,
        depreciationAmt: charge as unknown as Prisma.Decimal,
        closingValue: closing as unknown as Prisma.Decimal,
        rate: rate as unknown as Prisma.Decimal,
        appliedAt: postingDate,
      },
    }),
    prisma.asset.update({
      where: { id: assetId },
      data: {
        currentBookValue: closing as unknown as Prisma.Decimal,
        lastDepreciationDate: postingDate,
      },
    }),
  ]);

  return { assetId, posted: true, depreciationAmt: charge, closingValue: closing };
}

export async function runMonthlyDepreciationPosting(
  postingDate: Date = new Date(),
): Promise<{ processed: number; posted: number; skipped: number; errors: number; results: PostingResult[] }> {
  const year  = postingDate.getFullYear();
  const month = postingDate.getMonth() + 1;

  const assets = await prisma.asset.findMany({
    where: { status: "ACTIVE", depreciationMethod: { not: "NONE" } },
    select: { id: true },
  });

  const results: PostingResult[] = [];
  let posted = 0, skipped = 0, errors = 0;

  for (const a of assets) {
    try {
      const r = await postDepreciationForAsset(a.id, year, month, postingDate);
      results.push(r);
      if (r.posted) posted++; else skipped++;
    } catch (err) {
      errors++;
      results.push({ assetId: a.id, posted: false, reason: (err as Error).message });
    }
  }

  return { processed: assets.length, posted, skipped, errors, results };
}

export function seedImportedDepreciationBaseline(params: {
  acquisitionValue: number;
  accumulatedDepAmt: number | null | undefined;
  netBookValue: number | null | undefined;
  lastDepDate: Date | null | undefined;
}): { currentBookValue: number; lastDepreciationDate: Date | null } {
  const { acquisitionValue, accumulatedDepAmt, netBookValue, lastDepDate } = params;

  const currentBookValue =
    netBookValue != null
      ? netBookValue
      : accumulatedDepAmt != null
        ? Math.max(0, acquisitionValue - accumulatedDepAmt)
        : acquisitionValue;

  return { currentBookValue, lastDepreciationDate: lastDepDate ?? null };
}
