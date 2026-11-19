import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { parseGLAccountImportFile, validateGLAccountImportRows } from "@/lib/gl-account-import";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  const userId = user.id;

  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden — Super Admin only" }, { status: 403 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  const entityId = formData.get("entityId") as string | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!entityId) return NextResponse.json({ error: "Entity is required" }, { status: 400 });

  if (!file.name.match(/\.(csv|xlsx?|CSV|XLSX?)$/)) {
    return NextResponse.json({ error: "Only CSV or Excel (.xlsx/.xls) files are accepted" }, { status: 415 });
  }
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds the 10 MB maximum size" }, { status: 413 });

  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return NextResponse.json({ error: "Entity does not exist" }, { status: 422 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let rawRows;
  try { rawRows = parseGLAccountImportFile(buffer); }
  catch (err: any) { return NextResponse.json({ error: `Failed to parse file: ${err.message}` }, { status: 422 }); }
  if (rawRows.length === 0) return NextResponse.json({ error: "The file contains no data rows" }, { status: 422 });

  const [allGL, existingLinks] = await Promise.all([
    prisma.gLAccount.findMany({ select: { id: true, code: true, name: true } }),
    prisma.entityGLAccount.findMany({ where: { entityId }, select: { glAccountId: true } }),
  ]);
  const existingByCode = new Map(allGL.map((g) => [g.code.toUpperCase(), g]));
  const linkedIds = new Set(existingLinks.map((l) => l.glAccountId));
  const linkedCodesForEntity = new Set(
    allGL.filter((g) => linkedIds.has(g.id)).map((g) => g.code.toUpperCase())
  );

  const validated = validateGLAccountImportRows(rawRows, { entityId, existingByCode, linkedCodesForEntity });

  const validCount = validated.filter((r) => r.valid).length;
  const invalidCount = validated.length - validCount;

  const batch = await prisma.gLAccountImport.create({
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
    userId, action: "GL_ACCOUNT_IMPORT_UPLOADED", module: "admin", entityId,
    resourceId: batch.id, resourceType: "GLAccountImport",
    afterData: JSON.stringify({ fileName: file.name, totalRows: validated.length, validCount, invalidCount }),
  });

  return NextResponse.json({ success: true, data: batch }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batches = await prisma.gLAccountImport.findMany({
    include: { uploadedBy: { select: { name: true } }, entity: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: batches });
}
