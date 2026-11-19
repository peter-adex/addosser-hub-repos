import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batch = await prisma.gLAccountImport.findUnique({
    where: { id: params.id },
    include: { rows: { orderBy: { rowNumber: "asc" } }, uploadedBy: { select: { name: true, email: true } }, entity: { select: { name: true, code: true } } },
  });
  if (!batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: batch });
}
