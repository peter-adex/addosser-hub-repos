import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { seedImportedDepreciationBaseline } from "./depreciation-posting";

export const ASSET_IMPORT_TEMPLATE_HEADERS = [
  "ASSET CODE",
  "ASSET DESC",
  "BRANCH",
  "CLASSIFICATION",
  "ACQUISITION DATE",
  "ACQUISITION COST",
  "LAST DEP DATE",
  "LAST DEP AMT",
  "ACCUMULATED DEP AMT",
  "NET BOOK VALUE",
  "STATUS",
] as const;

export interface RawAssetRow {
  [key: string]: string | number | undefined;
}

export interface ValidatedAssetRow {
  rowNumber: number;
  raw: RawAssetRow;
  valid: boolean;
  errors: { field: string; error: string }[];
  normalized?: {
    assetNo: string;
    name: string;
    branchId: string;
    classificationId?: string;
    purchaseDate?: Date;
    acquisitionValue?: number;
    lastDepreciationDate?: Date;
    accumulatedDepAmt?: number;
    netBookValue?: number;
    status: string;
  };
}

const VALID_STATUSES = ["ACTIVE", "UNDER_MAINTENANCE", "DISPOSED", "MISSING", "DONATED", "TRANSFERRED", "RETIRED"];

export function parseAssetImportFile(buffer: Buffer): RawAssetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<RawAssetRow>(sheet, { defval: "" });
  return rows;
}

function parseDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}

function parseNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,₦\s]/g, ""));
  return isNaN(n) ? undefined : n;
}

export async function validateAssetImportRow(
  raw: RawAssetRow,
  rowNumber: number,
  context: { defaultBranchId: string; defaultEntityId: string; seenAssetNos: Set<string> },
): Promise<ValidatedAssetRow> {
  const errors: ValidatedAssetRow["errors"] = [];

  const assetNo = String(raw["ASSET CODE"] ?? "").trim();
  const name = String(raw["ASSET DESC"] ?? "").trim();
  const branchName = String(raw["BRANCH"] ?? "").trim();
  const classificationName = String(raw["CLASSIFICATION"] ?? "").trim();
  const purchaseDate = parseDate(raw["ACQUISITION DATE"]);
  const acquisitionValue = parseNumber(raw["ACQUISITION COST"]);
  const lastDepDate = parseDate(raw["LAST DEP DATE"]);
  const accumulatedDepAmt = parseNumber(raw["ACCUMULATED DEP AMT"]);
  const netBookValue = parseNumber(raw["NET BOOK VALUE"]);
  const statusRaw = String(raw["STATUS"] ?? "ACTIVE").trim().toUpperCase().replace(/\s+/g, "_");

  if (!assetNo) errors.push({ field: "ASSET CODE", error: "Asset code is required" });
  if (!name) errors.push({ field: "ASSET DESC", error: "Asset description is required" });
  if (!purchaseDate) errors.push({ field: "ACQUISITION DATE", error: "Invalid or missing date" });
  if (acquisitionValue === undefined || acquisitionValue <= 0) errors.push({ field: "ACQUISITION COST", error: "Invalid or missing acquisition cost" });
  if (!VALID_STATUSES.includes(statusRaw)) errors.push({ field: "STATUS", error: `Invalid status "${statusRaw}" — must be one of ${VALID_STATUSES.join(", ")}` });

  let branchId = context.defaultBranchId;
  let classificationId: string | undefined;

  if (assetNo) {
    if (context.seenAssetNos.has(assetNo)) {
      errors.push({ field: "ASSET CODE", error: "Duplicate asset code within this file" });
    } else {
      context.seenAssetNos.add(assetNo);
      const existing = await prisma.asset.findUnique({ where: { assetNo } });
      if (existing) errors.push({ field: "ASSET CODE", error: "Asset code already exists" });
    }
  }

  if (branchName) {
    const branch = await prisma.branch.findFirst({ where: { name: branchName, entityId: context.defaultEntityId } });
    if (!branch) {
      errors.push({ field: "BRANCH", error: `Branch "${branchName}" does not exist for the selected entity` });
    } else {
      branchId = branch.id;
    }
  }

  if (classificationName) {
    const classification = await prisma.assetClassification.findFirst({
      where: { OR: [{ name: classificationName }, { code: classificationName }] },
    });
    if (!classification) {
      errors.push({ field: "CLASSIFICATION", error: `Classification "${classificationName}" does not exist` });
    } else {
      classificationId = classification.id;
    }
  }

  const valid = errors.length === 0;

  return {
    rowNumber,
    raw,
    valid,
    errors,
    normalized: valid
      ? {
          assetNo, name, branchId, classificationId,
          purchaseDate, acquisitionValue,
          lastDepreciationDate: lastDepDate,
          accumulatedDepAmt, netBookValue,
          status: statusRaw,
        }
      : undefined,
  };
}

export async function executeAssetImport(importId: string, userId: string, entityId: string) {
  const batch = await prisma.assetImport.findUnique({
    where: { id: importId },
    include: { rows: { where: { status: "VALID" } } },
  });
  if (!batch) throw new Error("Import batch not found");

  let imported = 0;
  let skipped = 0;

  for (const row of batch.rows) {
    const raw = JSON.parse(row.rawData) as RawAssetRow;
    try {
      const assetNo = String(raw["ASSET CODE"] ?? "").trim();
      const existing = await prisma.asset.findUnique({ where: { assetNo } });
      if (existing) {
        await prisma.assetImportRow.update({
          where: { id: row.id },
          data: { status: "SKIPPED_DUPLICATE", errors: JSON.stringify([{ field: "ASSET CODE", error: "Asset code already exists (created after preview)" }]) },
        });
        skipped++;
        continue;
      }

      const branchName = String(raw["BRANCH"] ?? "").trim();
      const branch = branchName
        ? await prisma.branch.findFirst({ where: { name: branchName, entityId } })
        : await prisma.branch.findFirst({ where: { entityId } });
      if (!branch) {
        await prisma.assetImportRow.update({
          where: { id: row.id },
          data: { status: "INVALID", errors: JSON.stringify([{ field: "BRANCH", error: "No valid branch found at import time" }]) },
        });
        skipped++;
        continue;
      }

      const classificationName = String(raw["CLASSIFICATION"] ?? "").trim();
      const classification = classificationName
        ? await prisma.assetClassification.findFirst({ where: { OR: [{ name: classificationName }, { code: classificationName }] } })
        : null;

      const purchaseDate = parseDate(raw["ACQUISITION DATE"])!;
      const acquisitionValue = parseNumber(raw["ACQUISITION COST"])!;
      const lastDepDate = parseDate(raw["LAST DEP DATE"]);
      const accumulatedDepAmt = parseNumber(raw["ACCUMULATED DEP AMT"]);
      const netBookValue = parseNumber(raw["NET BOOK VALUE"]);
      const statusRaw = String(raw["STATUS"] ?? "ACTIVE").trim().toUpperCase().replace(/\s+/g, "_");
      const name = String(raw["ASSET DESC"] ?? "").trim();

      const { currentBookValue, lastDepreciationDate } = seedImportedDepreciationBaseline({
        acquisitionValue, accumulatedDepAmt, netBookValue, lastDepDate,
      });

      const asset = await prisma.asset.create({
        data: {
          assetNo,
          name,
          entityId,
          branchId: branch.id,
          classificationId: classification?.id ?? null,
          purchaseDate,
          acquisitionValue,
          currentBookValue,
          lastDepreciationDate,
          status: statusRaw as any,
          approvalStatus: "APPROVED",
          createdById: userId,
        },
      });

      await prisma.assetImportRow.update({
        where: { id: row.id },
        data: { status: "IMPORTED", createdAssetId: asset.id },
      });
      imported++;
    } catch (err: any) {
      await prisma.assetImportRow.update({
        where: { id: row.id },
        data: { status: "INVALID", errors: JSON.stringify([{ field: "_row", error: err.message ?? "Unknown error" }]) },
      });
      skipped++;
    }
  }

  const updated = await prisma.assetImport.update({
    where: { id: importId },
    data: { status: "CONFIRMED", importedRows: imported, skippedRows: batch.skippedRows + skipped, confirmedAt: new Date() },
  });

  await logAudit({
    userId,
    action: "ASSET_IMPORT_CONFIRMED",
    module: "assets",
    entityId,
    resourceId: importId,
    resourceType: "AssetImport",
    afterData: JSON.stringify({ imported, skipped }),
  });

  return { imported, skipped, batch: updated };
}
