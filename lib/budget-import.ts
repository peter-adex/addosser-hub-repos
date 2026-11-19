import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

export const BUDGET_IMPORT_TEMPLATE_HEADERS = [
  "S/N", "GL Code", "GL Name", "Entity", "Budget Year", "Annual Amount",
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC",
] as const;

const MONTH_HEADER_VARIANTS: string[][] = [
  ["JAN", "JANUARY"],
  ["FEB", "FEBRUARY"],
  ["MAR", "MARCH"],
  ["APR", "APRIL"],
  ["MAY"],
  ["JUN", "JUNE"],
  ["JUL", "JULY"],
  ["AUG", "AUGUST"],
  ["SEP", "SEPT", "SEPTEMBER"],
  ["OCT", "OCTOBER"],
  ["NOV", "NOVEMBER"],
  ["DEC", "DECEMBER"],
];

export interface RawBudgetRow { [key: string]: any }

export interface ValidatedBudgetRow {
  rowNumber: number;
  raw: RawBudgetRow;
  valid: boolean;
  errors: { field: string; error: string }[];
  normalized?: {
    glCode: string;
    glName: string;
    financialYear: number;
    annualAmount: number;
    monthlyAmounts: number[];
  };
}

function normalizeHeader(h: string): string {
  return String(h ?? "").trim().toUpperCase();
}

export function parseBudgetImportFile(buffer: Buffer): { headerRow: number; rows: RawBudgetRow[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    if (grid[i].some((cell) => normalizeHeader(cell) === "GL CODE")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error('Could not find the header row (expected a "GL Code" column within the first 10 rows).');
  }

  const headers = grid[headerRowIdx].map(normalizeHeader);
  const rows: RawBudgetRow[] = [];

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const rowArr = grid[r];
    if (!rowArr || rowArr.every((c) => c === "" || c === null || c === undefined)) continue;
    const obj: RawBudgetRow = {};
    headers.forEach((h, i) => { if (h) obj[h] = rowArr[i]; });
    rows.push(obj);
  }

  return { headerRow: headerRowIdx + 1, rows };
}

function findMonthValue(raw: RawBudgetRow, monthIdx: number): { found: boolean; raw: any } {
  for (const variant of MONTH_HEADER_VARIANTS[monthIdx]) {
    if (variant in raw) return { found: true, raw: raw[variant] };
  }
  return { found: false, raw: undefined };
}

function parseNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,₦\s]/g, ""));
  return isNaN(n) ? undefined : n;
}

export function validateBudgetImportRows(
  rows: RawBudgetRow[],
  context: {
    entityCode: string;
    glAccountsByCode: Map<string, { id: string; name: string; isActive: boolean }>;
    existingBudgetGlIds: Set<string>;
  },
): ValidatedBudgetRow[] {
  const seenCodes = new Set<string>();

  return rows.map((raw, i): ValidatedBudgetRow => {
    const rowNumber = i + 1;
    const errors: ValidatedBudgetRow["errors"] = [];

    const glCode = String(raw["GL CODE"] ?? "").trim();
    const glNameInFile = String(raw["GL NAME"] ?? "").trim();
    const entityInFile = String(raw["ENTITY"] ?? "").trim().toUpperCase();
    const financialYear = parseNumber(raw["BUDGET YEAR"]);
    const annualAmount = parseNumber(raw["ANNUAL AMOUNT"]);

    if (!glCode) errors.push({ field: "GL Code", error: "Missing GL Code" });
    if (!financialYear || financialYear < 2020 || financialYear > 2035) {
      errors.push({ field: "Budget Year", error: `Invalid financial year "${raw["BUDGET YEAR"]}"` });
    }
    if (entityInFile && entityInFile !== context.entityCode.toUpperCase()) {
      errors.push({ field: "Entity", error: `Row's Entity ("${entityInFile}") does not match the selected import entity ("${context.entityCode}")` });
    }

    let glAccount: { id: string; name: string } | undefined;
    if (glCode) {
      if (seenCodes.has(glCode)) {
        errors.push({ field: "GL Code", error: `Duplicate GL Code "${glCode}" within this file` });
      } else {
        seenCodes.add(glCode);
      }
      const found = context.glAccountsByCode.get(glCode.toUpperCase());
      if (!found) {
        errors.push({ field: "GL Code", error: `GL Code "${glCode}" does not exist in the chart of accounts. Create it first (Admin -> GL Accounts) or correct the code.` });
      } else if (!found.isActive) {
        errors.push({ field: "GL Code", error: `GL Code "${glCode}" (${found.name}) is inactive` });
      } else {
        glAccount = found;
        if (context.existingBudgetGlIds.has(found.id)) {
          errors.push({ field: "GL Code", error: `An OPEX budget already exists for "${glCode}" (${found.name}) in ${financialYear}` });
        }
      }
    }

    const monthlyAmounts: number[] = [];
    for (let m = 0; m < 12; m++) {
      const { found, raw: mRaw } = findMonthValue(raw, m);
      if (!found || mRaw === "" || mRaw === null || mRaw === undefined) {
        monthlyAmounts.push(0);
        continue;
      }
      const n = parseNumber(mRaw);
      if (n === undefined) {
        errors.push({ field: MONTH_HEADER_VARIANTS[m][0], error: `Non-numeric monthly value "${mRaw}"` });
        monthlyAmounts.push(0);
      } else if (n < 0) {
        errors.push({ field: MONTH_HEADER_VARIANTS[m][0], error: "Monthly amount cannot be negative" });
        monthlyAmounts.push(0);
      } else {
        monthlyAmounts.push(n);
      }
    }

    if (annualAmount === undefined || annualAmount < 0) {
      errors.push({ field: "Annual Amount", error: `Invalid or missing annual amount "${raw["ANNUAL AMOUNT"]}"` });
    }

    const valid = errors.length === 0;

    return {
      rowNumber,
      raw: {
        "GL Code": glCode,
        "GL Name": glNameInFile || glAccount?.name || "",
        "Entity": entityInFile,
        "Budget Year": financialYear,
        "Annual Amount": annualAmount,
        ...Object.fromEntries(MONTH_HEADER_VARIANTS.map((v, i) => [v[0], monthlyAmounts[i]])),
      },
      valid,
      errors,
      normalized: valid
        ? { glCode, glName: glNameInFile || glAccount!.name, financialYear: financialYear!, annualAmount: annualAmount!, monthlyAmounts }
        : undefined,
    };
  });
}

export async function executeBudgetImport(importId: string, userId: string, entityId: string) {
  const batch = await prisma.budgetImport.findUnique({
    where: { id: importId },
    include: { rows: { where: { status: "VALID" } } },
  });
  if (!batch) throw new Error("Import batch not found");

  const existingJunctions = await prisma.entityGLAccount.findMany({ where: { entityId } });
  const junctionByGlId = new Map(existingJunctions.map((j) => [j.glAccountId, j]));

  let imported = 0, skipped = 0;

  for (const row of batch.rows) {
    const raw = JSON.parse(row.rawData) as RawBudgetRow;
    try {
      const glCode = String(raw["GL Code"] ?? "").trim();
      const financialYear = Number(raw["Budget Year"]);
      const annualAmount = Number(raw["Annual Amount"]);
      const monthlyAmounts = MONTH_HEADER_VARIANTS.map((v) => Number(raw[v[0]] ?? 0));

      const glAccount = await prisma.gLAccount.findUnique({ where: { code: glCode } });
      if (!glAccount) {
        await prisma.budgetImportRow.update({ where: { id: row.id }, data: { status: "INVALID", errors: JSON.stringify([{ field: "GL Code", error: "GL account no longer exists" }]) } });
        skipped++; continue;
      }

      let entityGL = junctionByGlId.get(glAccount.id);
      if (!entityGL) {
        entityGL = await prisma.entityGLAccount.create({ data: { entityId, glAccountId: glAccount.id } });
        junctionByGlId.set(glAccount.id, entityGL);
      }

      const existing = await prisma.budget.findFirst({
        where: { entityGLId: entityGL.id, financialYear, budgetType: "OPEX", branchId: null },
      });
      if (existing) {
        await prisma.budgetImportRow.update({ where: { id: row.id }, data: { status: "SKIPPED_DUPLICATE", errors: JSON.stringify([{ field: "GL Code", error: "Budget already exists (created after preview)" }]) } });
        skipped++; continue;
      }

      const budget = await prisma.budget.create({
        data: {
          entityGLId: entityGL.id,
          financialYear,
          annualAmount,
          distributionType: "MANUAL",
          budgetType: "OPEX",
          status: "APPROVED",
          approvedAt: new Date(),
          notes: "Imported from Excel OPEX budget upload",
          createdById: userId,
          monthlyLines: { create: monthlyAmounts.map((amount, i) => ({ month: i + 1, amount })) },
        },
      });

      await prisma.budgetImportRow.update({ where: { id: row.id }, data: { status: "IMPORTED", createdBudgetId: budget.id } });
      imported++;
    } catch (err: any) {
      await prisma.budgetImportRow.update({ where: { id: row.id }, data: { status: "INVALID", errors: JSON.stringify([{ field: "_row", error: err.message ?? "Unknown error" }]) } });
      skipped++;
    }
  }

  const updated = await prisma.budgetImport.update({
    where: { id: importId },
    data: { status: "CONFIRMED", importedRows: imported, skippedRows: batch.skippedRows + skipped, confirmedAt: new Date() },
  });

  await logAudit({
    userId, action: "BUDGET_IMPORT_CONFIRMED", module: "budgeting", entityId,
    resourceId: importId, resourceType: "BudgetImport",
    afterData: JSON.stringify({ imported, skipped }),
  });

  return { imported, skipped, batch: updated };
}
