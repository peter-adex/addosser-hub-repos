import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission, userHasEntityAccess } from "@/lib/permissions";
import { createManualCredit } from "@/lib/gl-transactions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateCreditSchema = z.object({
  entityId: z.string().cuid(),
  glAccountCode: z.string().min(1),
  amount: z.number().positive("Credit amount must be greater than zero"),
  transactionDate: z.string().min(1),
  description: z.string().min(1, "Narration/description is required"),
  referenceNo: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  submit: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  if (!(await hasGranularPermission("finance", "gl_journal", "create"))) {
    return NextResponse.json({ error: "You do not have permission to create GL credit entries" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateCreditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }
  const data = parsed.data;

  if (!(await userHasEntityAccess(data.entityId))) {
    return NextResponse.json({ error: "You do not have access to this entity" }, { status: 403 });
  }

  const entity = await prisma.entity.findUnique({ where: { id: data.entityId } });
  if (!entity || !entity.isActive) {
    return NextResponse.json({ error: "Entity does not exist or is inactive" }, { status: 422 });
  }

  try {
    const result = await createManualCredit({
      entityId: data.entityId,
      glAccountCode: data.glAccountCode,
      amount: data.amount,
      transactionDate: data.transactionDate,
      description: data.description,
      referenceNo: data.referenceNo,
      attachmentUrl: data.attachmentUrl,
      createdById: userId,
      submit: data.submit,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create credit entry" }, { status: 422 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  if (!(await hasGranularPermission("finance", "gl_journal", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const and: any[] = [{ entryType: "CREDIT" }];
  if (!user.isSystem) {
    const accessRows = await prisma.userEntity.findMany({ where: { userId: user.id }, select: { entityId: true } });
    const accessibleEntityIds = [user.entityId, ...accessRows.map((r) => r.entityId)].filter(Boolean);
    and.push({ entityId: { in: accessibleEntityIds } });
  }
  if (entityId) and.push({ entityId });
  if (status) and.push({ status });

  const entries = await prisma.gLTransaction.findMany({
    where: { AND: and },
    include: {
      entity: { select: { name: true, code: true } },
      glAccount: { select: { code: true, name: true } },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ success: true, data: entries });
}
