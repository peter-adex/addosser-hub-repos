import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { checkPageAccess }           from "@/lib/rbac";
import { executeVehicleImport }      from "@/lib/vehicle-import";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const canImport = await checkPageAccess("fleet", "vehicles-import", "import");
  if (!canImport) return NextResponse.json({ error: "You do not have permission to import vehicles" }, { status: 403 });

  const batch = await prisma.vehicleImport.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
  if (batch.status === "CONFIRMED") return NextResponse.json({ error: "This import has already been confirmed" }, { status: 409 });
  if (!batch.entityId) return NextResponse.json({ error: "Import batch has no entity associated" }, { status: 422 });

  try {
    const result = await executeVehicleImport(params.id, userId, batch.entityId);
    return NextResponse.json({
      success: true,
      data: { total: batch.totalRows, valid: batch.validRows, invalid: batch.invalidRows, imported: result.imported, skipped: result.skipped },
    });
  } catch (err: any) {
    await prisma.vehicleImport.update({ where: { id: params.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: err.message ?? "Import failed" }, { status: 500 });
  }
}
