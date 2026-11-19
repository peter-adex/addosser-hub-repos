import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";
import { logAudit }                  from "@/lib/audit";
import { parseAssetImportFile, validateAssetImportRow } from "@/lib/asset-import";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const canImport = await hasGranularPermission("assets", "register", "create");
  if (!canImport) return NextResponse.json({ error: "You do not have permission to import assets" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const entityId = formData.get("entityId") as string | null;
  const defaultBranchId = formData.get("defaultBranchId") as string | null;

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!entityId) return NextResponse.json({ error: "Entity is required" }, { status: 400 });
  if (!defaultBranchId) return NextResponse.json({ error: "Default branch is required" }, { status: 400 });

  const allowedTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (file.type && !allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx?|CSV|XLSX?)$/)) {
    return NextResponse.json({ error: "Only CSV or Excel (.xlsx/.xls) files are accepted" }, { status: 415 });
  }
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds the 10 MB maximum size" }, { status: 413 });
  }

  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return NextResponse.json({ error: "Entity does not exist" }, { status: 422 });
  const defaultBranch = await prisma.branch.findFirst({ where: { id: defaultBranchId, entityId } });
  if (!defaultBranch) return NextResponse.json({ error: "Default branch does not belong to the selected entity" }, { status: 422 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let rawRows;
  try {
    rawRows = parseAssetImportFile(buffer);
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to parse file: ${err.message}` }, { status: 422 });
  }
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "The file contains no data rows" }, { status: 422 });
  }

  const seenAssetNos = new Set<string>();
  const validated = [];
  for (let i = 0; i < rawRows.length; i++) {
    const result = await validateAssetImportRow(rawRows[i], i + 2 , {
      defaultBranchId, defaultEntityId: entityId, seenAssetNos,
    });
    validated.push(result);
  }

  const validCount = validated.filter((r) => r.valid).length;
  const invalidCount = validated.length - validCount;

  const batch = await prisma.assetImport.create({
    data: {
      entityId,
      fileName: file.name,
      totalRows: validated.length,
      validRows: validCount,
      invalidRows: invalidCount,
      status: "VALIDATED",
      uploadedById: userId,
      rows: {
        create: validated.map((r) => ({
          rowNumber: r.rowNumber,
          rawData: JSON.stringify(r.raw),
          status: r.valid ? "VALID" : "INVALID",
          errors: r.errors.length ? JSON.stringify(r.errors) : null,
        })),
      },
    },
    include: { rows: true },
  });

  await logAudit({
    userId,
    action: "ASSET_IMPORT_UPLOADED",
    module: "assets",
    entityId,
    resourceId: batch.id,
    resourceType: "AssetImport",
    afterData: JSON.stringify({ fileName: file.name, totalRows: validated.length, validCount, invalidCount }),
  });

  return NextResponse.json({ success: true, data: batch }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const batches = await prisma.assetImport.findMany({
    where: user.isSystem ? {} : { entityId: user.entityId },
    include: { uploadedBy: { select: { name: true } }, entity: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: batches });
}
