import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission, userHasEntityAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasGranularPermission("finance", "gl_journal", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const txn = await prisma.gLTransaction.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { id: true, name: true, code: true } },
      glAccount: { select: { code: true, name: true, category: true } },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
    },
  });
  if (!txn) return NextResponse.json({ error: "GL entry not found" }, { status: 404 });

  if (!(await userHasEntityAccess(txn.entityId))) {
    return NextResponse.json({ error: "You do not have access to this entity" }, { status: 403 });
  }

  const instance = txn.approvalInstanceId
    ? await prisma.approvalInstance.findUnique({
        where: { id: txn.approvalInstanceId },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            include: {
              actionedBy: { select: { name: true, email: true } },
              assignedUser: { select: { name: true, email: true } },
            },
          },
          workflow: { select: { name: true } },
        },
      })
    : null;

  const audit = await prisma.auditLog.findMany({
    where: { resourceId: txn.id, resourceType: "GLTransaction" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ success: true, data: { transaction: txn, approvalInstance: instance, audit } });
}
