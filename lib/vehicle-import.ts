import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

export const VEHICLE_IMPORT_TEMPLATE_HEADERS = [
  "PLATE NUMBER", "MAKE", "MODEL", "YEAR", "CATEGORY", "COLOUR",
  "CHASSIS NUMBER", "ENGINE NUMBER", "MILEAGE", "PURCHASE DATE",
  "ACQUISITION VALUE", "USEFUL LIFE YEARS", "LOCATION",
] as const;

const VALID_CATEGORIES = ["saloon", "suv", "jeep", "truck", "motorcycle"];

export interface RawVehicleRow { [key: string]: string | number | undefined; }

export interface ValidatedVehicleRow {
  rowNumber: number;
  raw: RawVehicleRow;
  valid: boolean;
  errors: { field: string; error: string }[];
}

export function parseVehicleImportFile(buffer: Buffer): RawVehicleRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawVehicleRow>(sheet, { defval: "" });
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

export async function validateVehicleImportRow(
  raw: RawVehicleRow,
  rowNumber: number,
  context: { entityId: string; seenPlates: Set<string>; seenChassis: Set<string> },
): Promise<ValidatedVehicleRow> {
  const errors: ValidatedVehicleRow["errors"] = [];

  const plateNumber = String(raw["PLATE NUMBER"] ?? "").trim();
  const chassisNumber = String(raw["CHASSIS NUMBER"] ?? "").trim();
  const make = String(raw["MAKE"] ?? "").trim();
  const model = String(raw["MODEL"] ?? "").trim();
  const year = parseNumber(raw["YEAR"]);
  const category = String(raw["CATEGORY"] ?? "").trim().toLowerCase();
  const locationName = String(raw["LOCATION"] ?? "").trim();

  if (!plateNumber) errors.push({ field: "PLATE NUMBER", error: "Plate number is required" });
  if (!chassisNumber) errors.push({ field: "CHASSIS NUMBER", error: "Chassis number is required" });
  if (!make) errors.push({ field: "MAKE", error: "Make is required" });
  if (!model) errors.push({ field: "MODEL", error: "Model is required" });
  if (!year || year < 1990 || year > new Date().getFullYear() + 1) errors.push({ field: "YEAR", error: "Invalid year" });
  if (!VALID_CATEGORIES.includes(category)) errors.push({ field: "CATEGORY", error: `Invalid category — must be one of ${VALID_CATEGORIES.join(", ")}` });

  if (plateNumber) {
    if (context.seenPlates.has(plateNumber)) {
      errors.push({ field: "PLATE NUMBER", error: "Duplicate plate number within this file" });
    } else {
      context.seenPlates.add(plateNumber);
      const existing = await prisma.vehicle.findUnique({ where: { plateNumber } });
      if (existing) errors.push({ field: "PLATE NUMBER", error: "Plate number already exists" });
    }
  }
  if (chassisNumber) {
    if (context.seenChassis.has(chassisNumber)) {
      errors.push({ field: "CHASSIS NUMBER", error: "Duplicate chassis number within this file" });
    } else {
      context.seenChassis.add(chassisNumber);
      const existing = await prisma.vehicle.findUnique({ where: { chassisNumber } });
      if (existing) errors.push({ field: "CHASSIS NUMBER", error: "Chassis number already exists" });
    }
  }
  if (locationName) {
    const loc = await prisma.entityLocation.findFirst({ where: { name: locationName, entityId: context.entityId } });
    if (!loc) errors.push({ field: "LOCATION", error: `Location "${locationName}" does not exist for the selected entity` });
  }

  return { rowNumber, raw, valid: errors.length === 0, errors };
}

export async function executeVehicleImport(importId: string, userId: string, entityId: string) {
  const batch = await prisma.vehicleImport.findUnique({
    where: { id: importId },
    include: { rows: { where: { status: "VALID" } } },
  });
  if (!batch) throw new Error("Import batch not found");

  let imported = 0, skipped = 0;

  for (const row of batch.rows) {
    const raw = JSON.parse(row.rawData) as RawVehicleRow;
    try {
      const plateNumber = String(raw["PLATE NUMBER"] ?? "").trim();
      const chassisNumber = String(raw["CHASSIS NUMBER"] ?? "").trim();
      const [dupPlate, dupChassis] = await Promise.all([
        prisma.vehicle.findUnique({ where: { plateNumber } }),
        prisma.vehicle.findUnique({ where: { chassisNumber } }),
      ]);
      if (dupPlate || dupChassis) {
        await prisma.vehicleImportRow.update({
          where: { id: row.id },
          data: { status: "SKIPPED_DUPLICATE", errors: JSON.stringify([{ field: dupPlate ? "PLATE NUMBER" : "CHASSIS NUMBER", error: "Already exists (created after preview)" }]) },
        });
        skipped++; continue;
      }

      const locationName = String(raw["LOCATION"] ?? "").trim();
      const location = locationName
        ? await prisma.entityLocation.findFirst({ where: { name: locationName, entityId } })
        : null;

      const vehicle = await prisma.vehicle.create({
        data: {
          plateNumber, chassisNumber,
          make: String(raw["MAKE"] ?? "").trim(),
          model: String(raw["MODEL"] ?? "").trim(),
          year: parseNumber(raw["YEAR"])!,
          category: String(raw["CATEGORY"] ?? "").trim().toLowerCase(),
          colour: String(raw["COLOUR"] ?? "").trim() || null,
          engineNumber: String(raw["ENGINE NUMBER"] ?? "").trim() || null,
          mileage: parseNumber(raw["MILEAGE"]) ?? 0,
          purchaseDate: parseDate(raw["PURCHASE DATE"]) ?? null,
          acquisitionValueNgn: parseNumber(raw["ACQUISITION VALUE"]) ?? null,
          usefulLifeYears: parseNumber(raw["USEFUL LIFE YEARS"]) ?? 5,
          entityId,
          locationId: location?.id ?? null,
          status: "idle",
          allocationStatus: "available",
        },
      });

      await prisma.vehicleImportRow.update({ where: { id: row.id }, data: { status: "IMPORTED", createdVehicleId: vehicle.id } });
      imported++;
    } catch (err: any) {
      await prisma.vehicleImportRow.update({
        where: { id: row.id },
        data: { status: "INVALID", errors: JSON.stringify([{ field: "_row", error: err.message ?? "Unknown error" }]) },
      });
      skipped++;
    }
  }

  const updated = await prisma.vehicleImport.update({
    where: { id: importId },
    data: { status: "CONFIRMED", importedRows: imported, skippedRows: batch.skippedRows + skipped, confirmedAt: new Date() },
  });

  await logAudit({
    userId, action: "VEHICLE_IMPORT_CONFIRMED", module: "fleet", entityId,
    resourceId: importId, resourceType: "VehicleImport",
    afterData: JSON.stringify({ imported, skipped }),
  });

  return { imported, skipped, batch: updated };
}
