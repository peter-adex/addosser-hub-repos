import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processTranche, PaymentError } from "@/lib/payment";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  paymentMethod: z.enum(["BANK_TRANSFER", "RTGS", "NEFT", "CHEQUE", "CASH"], {
    errorMap: () => ({ message: "Invalid payment method" }),
  }),
  transactionRef: z.string().min(1, "Transaction reference is required"),
  paidAt:         z.string().optional(),
  tellerNotes:    z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { trancheId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.process && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let body: z.infer<typeof BodySchema>;
    try {
      const raw = await req.json();
      body = BodySchema.parse(raw);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const latestProof = await prisma.paymentProof.findFirst({
      where: { paymentTrancheId: params.trancheId },
      orderBy: { uploadedAt: "desc" },
      select: { fileUrl: true },
    });

    const tellerNotes = [
      body.paidAt ? `Payment date: ${new Date(body.paidAt).toLocaleString("en-NG")}` : null,
      body.tellerNotes?.trim() || null,
    ]
      .filter(Boolean)
      .join(" — ") || undefined;

    const tranche = await processTranche({
      trancheId:         params.trancheId,
      processedById:     user.id,
      paymentMethod:     body.paymentMethod,
      transactionRef:    body.transactionRef,
      proofOfPaymentUrl: latestProof?.fileUrl,
      tellerNotes,
    });

    return NextResponse.json({ success: true, trancheId: params.trancheId });
  } catch (err: any) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH /api/payment/tranches/[trancheId]/process]", err);
    return NextResponse.json(
      { error: "Failed to submit payment. Please try again." },
      { status: 500 }
    );
  }
}
