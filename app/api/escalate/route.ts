import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { escalateInvoice } from "@/lib/payment-v2";

export const dynamic = "force-dynamic";

const EscalateSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  reason: z.string().min(10, "Please provide a meaningful reason (min 10 characters)"),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.assign && !user.isSystem) {
      return NextResponse.json(
        { error: "You do not have permission to escalate payments." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = EscalateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const escalation = await escalateInvoice({
      invoiceId: parsed.data.invoiceId,
      escalatedById: user.id,
      escalatedByRole: user.roleName,
      reason: parsed.data.reason,
      comment: parsed.data.comment,
    });

    return NextResponse.json({ success: true, escalation }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/payment/escalate]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to escalate invoice" },
      { status: 500 }
    );
  }
}
