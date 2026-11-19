import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM_EMAIL, resend } from "@/lib/resend";
import { processApprovalAction } from "@/lib/approval-workflow";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/base-url";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const userId = (session.user as any).id;

  const instance = await prisma.approvalInstance.findFirst({
    where: {
      resourceId: params.id,
      resourceType: "Invoice",
      status: "IN_PROGRESS",
    },
  });
  if (!instance) {
    return NextResponse.json(
      { error: "No active approval process found for this invoice" },
      { status: 404 },
    );
  }

  try {
    const result = await processApprovalAction({
      instanceId: instance.id,
      approverId: userId,
      action: parsed.data.action,
      comment: parsed.data.comment,
    });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: true },
    });
    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (result.newInstanceStatus === "FULLY_APPROVED") {
      await prisma.invoice.update({
        where: { id: params.id },
        data: { status: "APPROVED", approvalStatus: "APPROVED" },
      });

      if (
        invoice.isExceptionalApproval &&
        invoice.glAccountCode &&
        invoice.exceedanceAmount
      ) {
        await logAudit({
          userId,
          action: "EXCEPTIONAL_INVOICE_APPROVED",
          module: "invoice",
          entityId: invoice.entityId,
          resourceId: invoice.id,
          resourceType: "Invoice",
          afterData: JSON.stringify({
            invoiceNo: invoice.invoiceNo,
            glAccountCode: invoice.glAccountCode,
            exceedanceAmount: Number(invoice.exceedanceAmount),
            justification: invoice.exceptionalJustification,
            negativeVariance: true,
          }),
        });
      }

      await createNotification({
        userId: invoice.submittedById,
        title: "Invoice Fully Approved ✅",
        message: `Invoice ${invoice.invoiceNo} has been fully approved and is ready for payment.`,
        type: "APPROVAL",
        actionUrl: `/invoice/${invoice.id}`,
      });

      if (invoice.invoiceType === "FLEET_FUEL") {
        const fuelLines = invoice.lineItems.filter((li) => li.vehicleId);
        for (const line of fuelLines) {
          try {
            const vehicle = await prisma.vehicle.findUnique({
              where: { id: line.vehicleId! },
              select: { assignedDriverId: true, mileage: true },
            });
            if (!vehicle?.assignedDriverId) {
              console.warn(
                `[InvoiceApprove] FLEET_FUEL invoice ${invoice.invoiceNo} line ${line.id} approved but vehicle has no assigned driver — FuelLog not created.`,
              );
              continue;
            }
            const litres = Number(line.quantity);
            await prisma.fuelLog.upsert({
              where: { invoiceLineItemId: line.id },
              update: {},
              create: {
                invoiceLineItemId: line.id,
                vehicleId: line.vehicleId!,
                driverId: vehicle.assignedDriverId,
                entityId: invoice.entityId,
                date: new Date(),
                litres,
                costPerLitre: Number(line.unitCost),
                totalCost: Number(line.totalCost),
                odometerKm: vehicle.mileage,
                station: invoice.vendorName,
              },
            });
          } catch (err) {
            console.error(
              `[InvoiceApprove] Failed to write FuelLog for approved fuel invoice ${invoice.invoiceNo}, line ${line.id}:`,
              err,
            );
          }
        }
      }

    } else if (result.newInstanceStatus === "REJECTED") {
      await prisma.invoice.update({
        where: { id: params.id },
        data: { status: "REJECTED", approvalStatus: "REJECTED" },
      });

      await prisma.actualLine.deleteMany({ where: { invoiceId: invoice.id } });

      await createNotification({
        userId: invoice.submittedById,
        title: "Invoice Rejected ❌",
        message: `Invoice ${invoice.invoiceNo} was rejected. ${parsed.data.comment ? `Reason: ${parsed.data.comment}` : ""}`,
        type: "ERROR",
        actionUrl: `/invoice/${invoice.id}`,
      });

    } else if (result.newInstanceStatus === "IN_PROGRESS") {
      const updatedInstance = await prisma.approvalInstance.findUnique({
        where: { id: instance.id },
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
        },
      });

      const nextActiveStep = updatedInstance?.steps.find(
        (s) =>
          s.stepNumber === updatedInstance.currentStep &&
          s.status === "PENDING",
      );

      if (nextActiveStep) {
        if (!nextActiveStep.roleId) {
          throw new Error(
            `Approval step ${nextActiveStep.stepNumber} has no role assigned`,
          );
        }

        const nextStepApprovers = await prisma.user.findMany({
          where: {
            roleId: nextActiveStep.roleId,
            isActive: true,
            OR: [
              { entityId: invoice.entityId },
              {
                entityAccess: {
                  some: {
                    entityId: invoice.entityId,
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        for (const approver of nextStepApprovers) {
          await createNotification({
            userId: approver.id,
            title: `Invoice Review Required — Step ${nextActiveStep.stepNumber}`,
            message: `Invoice ${invoice.invoiceNo} has been approved by the previous level and is now awaiting your sign-off.`,
            type: "APPROVAL",
            actionUrl: `/invoice/${invoice.id}`,
          });

          try {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: approver.email,
              subject: `[Action Required] Invoice Approval Step ${nextActiveStep.stepNumber} · ${invoice.invoiceNo}`,
              text: `Hello ${approver.name},\n\nInvoice ${invoice.invoiceNo} from ${invoice.vendorName} requires your management review sign-off.\n\nPlease click the link below to view details and process your action:\n${getBaseUrl()}/invoice/${invoice.id}\n\nThank you,\nEnterprise Workflow Engine.`,
            });
          } catch (emailErr) {
            console.error(
              "[NextStepNotify] Email notification failed to dispatch workflow email:",
              emailErr,
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    const status = err.message?.includes("not found")
      ? 404
      : err.message?.includes("not authorised")
        ? 403
        : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
