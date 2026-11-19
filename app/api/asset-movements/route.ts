import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId") ?? undefined;
  const status   = searchParams.get("status") ?? undefined;
  const search   = searchParams.get("search") ?? undefined;

  const and: any[] = [{ requestStatus: { not: null } }];
  if (!user.isSystem) {
    and.push({ OR: [{ fromEntityId: user.entityId }, { toEntityId: user.entityId }] });
  }
  if (entityId) {
    and.push({ OR: [{ fromEntityId: entityId }, { toEntityId: entityId }] });
  }
  if (status) {
    and.push({ requestStatus: status });
  }
  if (search) {
    and.push({
      OR: [
        { assetCodeSnapshot: { contains: search } },
        { assetDescSnapshot: { contains: search } },
      ],
    });
  }
  const where: any = { AND: and };

  const movements = await prisma.assetMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      asset:       { select: { assetNo: true, name: true, status: true } },
      fromEntity:  { select: { name: true, code: true } },
      toEntity:    { select: { name: true, code: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ success: true, data: movements });
}
