import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { hasGranularPermission }     from "@/lib/permissions";
import { logAudit }                  from "@/lib/audit";
import { parseBudgetImportFile, validateBudgetImportRows } from "@/lib/budget-import";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const canImport = await hasGranularPermission("budgeting", "import_export", "create");
  if (!canImport) return NextResponse.json({ error: "You do not have permission to import budgets" }, { status: 403 });

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
  let parsed;
  try { parsed = parseBudgetImportFile(buffer); }
  catch (err: any) { return NextResponse.json({ error: `Failed to parse file: ${err.message}` }, { status: 422 }); }
  if (parsed.rows.length === 0) return NextResponse.json({ error: "The file contains no data rows" }, { status: 422 });

  const financialYearFromFile = parsed.rows
    .map((r) => Number(r["BUDGET YEAR"]))
    .find((y) => Number.isFinite(y) && y >= 2020 && y <= 2035) ?? new Date().getFullYear();

  const [allGlAccounts, existingBudgets] = await Promise.all([
    prisma.gLAccount.findMany({ select: { id: true, code: true, name: true, isActive: true } }),
    prisma.budget.findMany({
      where: {
        financialYear: financialYearFromFile,
        budgetType: "OPEX",
        entityGL: { entityId },
      },
      select: { entityGL: { select: { glAccountId: true } } },
    }),
  ]);

  const glAccountsByCode = new Map(allGlAccounts.map((g) => [g.code.toUpperCase(), g]));
  const existingBudgetGlIds = new Set(existingBudgets.map((b) => b.entityGL.glAccountId));

  const validated = validateBudgetImportRows(parsed.rows, {
    entityCode: entity.code,
    glAccountsByCode,
    existingBudgetGlIds,
  });

  const validCount = validated.filter((r) => r.valid).length;
  const invalidCount = validated.length - validCount;

  const batch = await prisma.budgetImport.create({
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
    userId, action: "BUDGET_IMPORT_UPLOADED", module: "budgeting", entityId,
    resourceId: batch.id, resourceType: "BudgetImport",
    afterData: JSON.stringify({ fileName: file.name, totalRows: validated.length, validCount, invalidCount, financialYear: financialYearFromFile }),
  });

  return NextResponse.json({ success: true, data: batch }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const batches = await prisma.budgetImport.findMany({
    where: user.isSystem ? {} : { entityId: user.entityId },
    include: { uploadedBy: { select: { name: true } }, entity: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: batches });
}
