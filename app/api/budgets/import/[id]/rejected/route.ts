import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.budgetImportRow.findMany({
    where: { importId: params.id, status: { in: ["INVALID", "SKIPPED_DUPLICATE"] } },
    orderBy: { rowNumber: "asc" },
  });
  if (rows.length === 0) return NextResponse.json({ error: "No rejected rows for this import" }, { status: 404 });

  const header = "Row,Field,Error,RawData\n";
  const lines = rows.flatMap((r) => {
    const errors = r.errors ? JSON.parse(r.errors) as { field: string; error: string }[] : [{ field: "", error: r.status }];
    const raw = r.rawData.replace(/"/g, '""');
    return errors.map((e) => `${r.rowNumber},"${e.field}","${e.error}","${raw}"`);
  });
  const csv = header + lines.join("\n");

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="budget-import-rejected-${params.id}.csv"` },
  });
}
