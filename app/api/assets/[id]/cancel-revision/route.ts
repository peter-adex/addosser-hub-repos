import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { Prisma }                    from "@prisma/client";
import { logAudit }                  from "@/lib/audit";
import { resend, FROM_EMAIL }        from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (asset.createdById !== user.id && !user.isSystem) {
    return NextResponse.json({ error: "Only the requisitioner or a Super Admin can cancel this update" }, { status: 403 });
  }
  if (asset.pendingChanges == null) {
    return NextResponse.json({ error: "There is no pending update to cancel." }, { status: 409 });
  }

  let notifiedApprovers = 0;

  if (asset.pendingChangeInstanceId) {
    const instance = await prisma.approvalInstance.findUnique({
      where: { id: asset.pendingChangeInstanceId },
    });

    if (instance && instance.status === "IN_PROGRESS") {
      const pendingStep = await prisma.approvalInstanceStep.findFirst({
        where: { instanceId: instance.id, stepNumber: instance.currentStep, status: "PENDING" },
      });

      await prisma.approvalInstance.update({
        where: { id: instance.id },
        data:  { status: "CANCELLED", completedAt: new Date() },
      });

      if (pendingStep) {
        const approvers = pendingStep.userId
          ? await prisma.user.findMany({ where: { id: pendingStep.userId }, select: { id: true, name: true, email: true } })
          : pendingStep.roleId
            ? await prisma.user.findMany({ where: { roleId: pendingStep.roleId, isActive: true, entityId: asset.entityId }, select: { id: true, name: true, email: true } })
            : [];
        if (!pendingStep.userId && !pendingStep.roleId) {
          console.error(
            `[cancel-revision] Step ${pendingStep.stepNumber} of instance ${instance.id} has neither roleId nor userId set — skipping notification.`,
          );
        }

        for (const approver of approvers) {
          await prisma.notification.create({
            data: {
              userId:            approver.id,
              type:              "INFO",
              title:             "Approval no longer needed",
              message:           `The pending update to asset "${asset.name}" (${asset.assetNo}) was withdrawn by the requester — there is nothing left for you to review.`,
              relatedInstanceId: instance.id,
              module:            "assets",
            },
          });
          await resend.emails.send({
            from:    FROM_EMAIL,
            to:      approver.email,
            subject: `Withdrawn — Asset Update for ${asset.assetNo}`,
            html: `
              <p>Hello ${approver.name},</p>
              <p>The pending update to asset <strong>${asset.name}</strong> (${asset.assetNo}) was withdrawn by the requester.</p>
              <p><strong>There is nothing left for you to review or approve on this request.</strong></p>
            `,
          }).catch(() => {});
          notifiedApprovers++;
        }
      }
    }
  }

  await prisma.asset.update({
    where: { id: params.id },
    data:  { pendingChanges: Prisma.JsonNull, pendingChangeInstanceId: null },
  });

  await logAudit({
    userId:       user.id,
    action:       "ASSET_REVISION_CANCELLED",
    module:       "assets",
    entityId:     asset.entityId,
    resourceId:   params.id,
    resourceType: "Asset",
    beforeData:   JSON.stringify({ pendingChanges: asset.pendingChanges, pendingChangeInstanceId: asset.pendingChangeInstanceId }),
  });

  return NextResponse.json({
    success: true,
    message: notifiedApprovers > 0
      ? `Update cancelled. ${notifiedApprovers} approver(s) notified there is nothing left to review.`
      : "Update cancelled.",
  });
}
