import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { executeGLAccountImport }    from "@/lib/gl-account-import";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  if (!user.isSystem && user.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden — Super Admin only" }, { status: 403 });
  }

  const batch = await prisma.gLAccountImport.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
  if (batch.status === "CONFIRMED") return NextResponse.json({ error: "This import has already been confirmed" }, { status: 409 });

  try {
    const result = await executeGLAccountImport(params.id, user.id, batch.entityId);
    return NextResponse.json({
      success: true,
      data: {
        total: batch.totalRows,
        valid: batch.validRows,
        invalid: batch.invalidRows,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
      },
    });
  } catch (err: any) {
    await prisma.gLAccountImport.update({ where: { id: params.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: err.message ?? "Import failed" }, { status: 500 });
  }
}
