import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

export const GL_ACCOUNT_IMPORT_TEMPLATE_HEADERS = ["GL CODE", "GL NAME"] as const;

export interface RawGLRow { [key: string]: any }

export interface ValidatedGLRow {
  rowNumber: number;
  raw: RawGLRow;
  valid: boolean;
  errors: { field: string; error: string }[];
}

function normalizeHeader(h: string): string {
  return String(h ?? "").trim().toUpperCase();
}

export function parseGLAccountImportFile(buffer: Buffer): RawGLRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    if (grid[i].some((c) => normalizeHeader(c) === "GL CODE")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error('Could not find the header row (expected a "GL CODE" column within the first 5 rows).');
  }

  const headers = grid[headerRowIdx].map(normalizeHeader);
  const rows: RawGLRow[] = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const rowArr = grid[r];
    if (!rowArr || rowArr.every((c) => c === "" || c === null || c === undefined)) continue;
    const obj: RawGLRow = {};
    headers.forEach((h, i) => { if (h) obj[h] = rowArr[i]; });
    rows.push(obj);
  }
  return rows;
}

export function validateGLAccountImportRows(
  rows: RawGLRow[],
  context: {
    entityId: string;
    existingByCode: Map<string, { id: string; name: string }>;
    linkedCodesForEntity: Set<string>;
  },
): ValidatedGLRow[] {
  const seenCodes = new Set<string>();

  return rows.map((raw, i): ValidatedGLRow => {
    const rowNumber = i + 1;
    const errors: ValidatedGLRow["errors"] = [];

    const code = String(raw["GL CODE"] ?? "").trim();
    const name = String(raw["GL NAME"] ?? "").trim();

    if (!code) errors.push({ field: "GL CODE", error: "Missing GL Code" });
    else if (!/^[A-Za-z0-9\-_/]+$/.test(code)) {
      errors.push({ field: "GL CODE", error: `Invalid GL Code format "${code}" — only letters, numbers, hyphens and slashes are allowed` });
    }
    if (!name) errors.push({ field: "GL NAME", error: "Missing GL Name" });

    if (code) {
      const key = code.toUpperCase();
      if (seenCodes.has(key)) {
        errors.push({ field: "GL CODE", error: `Duplicate GL Code "${code}" within this file` });
      } else {
        seenCodes.add(key);
      }
    }

    return {
      rowNumber,
      raw: { "GL CODE": code, "GL NAME": name },
      valid: errors.length === 0,
      errors,
    };
  });
}

export async function executeGLAccountImport(importId: string, userId: string, entityId: string) {
  const batch = await prisma.gLAccountImport.findUnique({
    where: { id: importId },
    include: { rows: { where: { status: "VALID" } } },
  });
  if (!batch) throw new Error("Import batch not found");

  const allGLAccounts = await prisma.gLAccount.findMany();
  const byCode = new Map(allGLAccounts.map((g) => [g.code.toUpperCase(), g]));
  const existingLinks = await prisma.entityGLAccount.findMany({ where: { entityId } });
  const linkedGlIds = new Set(existingLinks.map((l) => l.glAccountId));

  let imported = 0, updated = 0, skipped = 0;

  for (const row of batch.rows) {
    const raw = JSON.parse(row.rawData) as RawGLRow;
    try {
      const code = String(raw["GL CODE"] ?? "").trim();
      const name = String(raw["GL NAME"] ?? "").trim();
      const existing = byCode.get(code.toUpperCase());

      if (!existing) {
        const created = await prisma.gLAccount.create({
          data: { code, name, category: "GENERAL" },
        });
        await prisma.entityGLAccount.create({ data: { entityId, glAccountId: created.id } });
        byCode.set(code.toUpperCase(), created);
        linkedGlIds.add(created.id);
        await prisma.gLAccountImportRow.update({ where: { id: row.id }, data: { status: "IMPORTED", createdGLAccountId: created.id } });
        imported++;
        continue;
      }

      const alreadyLinked = linkedGlIds.has(existing.id);
      const nameMatches = existing.name.trim() === name;

      if (alreadyLinked && nameMatches) {
        await prisma.gLAccountImportRow.update({ where: { id: row.id }, data: { status: "SKIPPED_DUPLICATE" } });
        skipped++;
        continue;
      }

      if (!alreadyLinked) {
        await prisma.entityGLAccount.create({ data: { entityId, glAccountId: existing.id } });
        linkedGlIds.add(existing.id);
      }
      if (!nameMatches) {
        await prisma.gLAccount.update({ where: { id: existing.id }, data: { name } });
        byCode.set(code.toUpperCase(), { ...existing, name });
      }

      await prisma.gLAccountImportRow.update({ where: { id: row.id }, data: { status: "UPDATED", createdGLAccountId: existing.id } });
      updated++;
    } catch (err: any) {
      await prisma.gLAccountImportRow.update({
        where: { id: row.id },
        data: { status: "INVALID", errors: JSON.stringify([{ field: "_row", error: err.message ?? "Unknown error" }]) },
      });
      skipped++;
    }
  }

  const result = await prisma.gLAccountImport.update({
    where: { id: importId },
    data: { status: "CONFIRMED", importedRows: imported, updatedRows: updated, skippedRows: batch.skippedRows + skipped, confirmedAt: new Date() },
  });

  await logAudit({
    userId, action: "GL_ACCOUNT_IMPORT_CONFIRMED", module: "admin", entityId,
    resourceId: importId, resourceType: "GLAccountImport",
    afterData: JSON.stringify({ imported, updated, skipped }),
  });

  return { imported, updated, skipped, batch: result };
}
