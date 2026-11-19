import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
<<<<<<< HEAD
import { hasGranularPermission } from "@/lib/permissions";
import { sendBudgetApprovalEmail } from "@/lib/resend";
import { z } from "zod";

export const dynamic = "force-dynamic";

=======
import { hasPermission } from "@/lib/permissions";
import { sendBudgetApprovalEmail } from "@/lib/resend";
import { z } from "zod";

>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
const ApproveSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

<<<<<<< HEAD
  const canApprove = await hasGranularPermission("budgeting", "approvals", "approve");
=======
  const canApprove = await hasPermission("budgeting", "canApprove");
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  if (!canApprove) return NextResponse.json({ error: "Forbidden — approval permission required" }, { status: 403 });

  const body = await req.json();
  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const budget = await prisma.budget.findUnique({
    where: { id: params.id },
    include: {
      entityGL: { include: { glAccount: true, entity: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  const userId = (session.user as any).id;

<<<<<<< HEAD
=======
  // Prevent self-approval
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  if (budget.createdById === userId) {
    return NextResponse.json({ error: "You cannot approve your own budget" }, { status: 409 });
  }

  const { action, comment } = parsed.data;

  const [updatedBudget, approval] = await prisma.$transaction([
    prisma.budget.update({
      where: { id: params.id },
      data: {
        status: action === "APPROVED" ? "APPROVED" : "REJECTED",
        approvedAt: action === "APPROVED" ? new Date() : null,
      },
    }),
    prisma.budgetApproval.create({
      data: { budgetId: params.id, approvedById: userId, action, comment },
    }),
  ]);

<<<<<<< HEAD
=======
  // Send email notification
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  try {
    await sendBudgetApprovalEmail({
      to: budget.createdBy.email,
      name: budget.createdBy.name,
      action,
      glName: budget.entityGL.glAccount.name,
      entity: budget.entityGL.entity.name,
      year: budget.financialYear,
      comment,
    });
  } catch (e) {
    console.error("[BudgetApproval] Email failed:", e);
  }

  await logAudit({
    userId,
    action: `BUDGET_${action}`,
    module: "budgeting",
    resourceId: params.id,
    meta: { action, comment },
  });

  return NextResponse.json({ success: true, data: { budget: updatedBudget, approval } });
}
