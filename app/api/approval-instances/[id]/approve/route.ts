import { NextRequest, NextResponse }      from "next/server";
import { getServerSession }               from "next-auth";
import { authOptions }                    from "@/lib/auth";
import { processApprovalAction }          from "@/lib/approval-workflow";
import { prisma }                         from "@/lib/prisma";
import { z }                              from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  action:  z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  req:    NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body   = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const userId = (session.user as any).id;
  const ip     = req.headers.get("x-forwarded-for")
               ?? req.headers.get("x-real-ip")
               ?? undefined;

  try {
    const result = await processApprovalAction({
      instanceId: params.id,
      approverId: userId,
      action:     parsed.data.action,
      comment:    parsed.data.comment,
      ipAddress:  ip ?? undefined,
    });

    const instance = await prisma.approvalInstance.findUnique({
      where: { id: params.id },
    });

    if (instance) {
      const newStatus =
        result.newInstanceStatus === "FULLY_APPROVED" ? "APPROVED" :
        result.newInstanceStatus === "REJECTED"       ? "REJECTED" :
        "PENDING_APPROVAL";

      if (instance.module === "assets" && instance.resourceType === "Asset") {
        await prisma.asset.update({
          where: { id: instance.resourceId },
          data:  { approvalStatus: newStatus === "APPROVED" ? "APPROVED" : newStatus === "REJECTED" ? "REJECTED" : "PENDING_APPROVAL" },
        });
      } else if (instance.resourceType === "AssetMovement") {
      } else if (instance.module === "invoice") {
        await prisma.invoice.update({
          where: { id: instance.resourceId },
          data:  { status: newStatus === "APPROVED" ? "APPROVED" : newStatus === "REJECTED" ? "REJECTED" : "UNDER_REVIEW" },
        });
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404
                 : err.message?.includes("not authorised") ? 403
                 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
