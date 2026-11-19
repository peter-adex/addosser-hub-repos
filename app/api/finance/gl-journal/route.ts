import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission, userHasEntityAccess } from "@/lib/permissions";
import { createJournalEntry } from "@/lib/gl-journal";
import { z } from "zod";

export const dynamic = "force-dynamic";

const LineSchema = z.object({
  entityId: z.string().cuid(),
  glAccountCode: z.string().min(1),
  entryType: z.enum(["DEBIT", "CREDIT"]),
  amount: z.number().positive(),
  description: z.string().optional(),
});

const CreateSchema = z.object({
  lines: z.array(LineSchema).min(2, "A journal entry needs at least one debit and one credit line"),
  description: z.string().min(1, "Description is required"),
  referenceNo: z.string().optional(),
  transactionDate: z.string().min(1),
  submit: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  if (!(await hasGranularPermission("finance", "gl_journal", "create"))) {
    return NextResponse.json({ error: "You do not have permission to create GL journal entries" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }
  const data = parsed.data;

  const distinctEntityIds = Array.from(new Set(data.lines.map((l) => l.entityId)));
  for (const entityId of distinctEntityIds) {
    if (!(await userHasEntityAccess(entityId))) {
      return NextResponse.json({ error: "You do not have access to one of the entities in this journal entry" }, { status: 403 });
    }
  }

  try {
    const result = await createJournalEntry({
      lines: data.lines,
      description: data.description,
      referenceNo: data.referenceNo,
      transactionDate: data.transactionDate,
      createdById: userId,
      submit: data.submit,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create journal entry" }, { status: 422 });
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
  const status = searchParams.get("status") ?? undefined;

  const and: any[] = [];
  if (!user.isSystem) {
    const accessRows = await prisma.userEntity.findMany({ where: { userId: user.id }, select: { entityId: true } });
    const accessibleEntityIds = [user.entityId, ...accessRows.map((r) => r.entityId)].filter(Boolean);
    and.push({ lines: { some: { entityId: { in: accessibleEntityIds } } } });
  }
  if (status) and.push({ status });

  const entries = await prisma.gLJournalEntry.findMany({
    where: and.length ? { AND: and } : undefined,
    include: {
      lines: { include: { entity: { select: { code: true } }, glAccount: { select: { code: true, name: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: entries });
}
