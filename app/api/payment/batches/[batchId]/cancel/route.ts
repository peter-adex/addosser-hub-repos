import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hasGranularPermission } from "@/lib/permissions";
import { cancelPaymentBatch, PaymentError } from "@/lib/payment";

const bodySchema = z.object({ reason: z.string().min(3, "A reason is required").max(2000) });

export async function POST(req: NextRequest, { params }: { params: { batchId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = user.isSystem || (await hasGranularPermission("payment", "workflow", "assign"));
  if (!allowed) return NextResponse.json({ error: "You do not have permission to cancel a payment assignment" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const batch = await cancelPaymentBatch({ batchId: params.batchId, cancelledById: user.id, reason: parsed.data.reason });
    return NextResponse.json({ batch });
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[POST /api/payment/batches/:id/cancel]", err);
    return NextResponse.json({ error: "Failed to cancel payment" }, { status: 500 });
  }
}
