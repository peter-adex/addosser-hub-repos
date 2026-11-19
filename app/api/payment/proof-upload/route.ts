import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Failed to parse upload — ensure the request is multipart/form-data" },
        { status: 400 }
      );
    }

    const trancheId = formData.get("trancheId") as string | null;
    const file      = formData.get("file") as File | null;

    if (!trancheId) {
      return NextResponse.json({ error: "trancheId is required" }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided or file is empty" }, { status: 400 });
    }

    const tranche = await prisma.paymentTranche.findUnique({
      where: { id: trancheId },
      include: { paymentBatch: { select: { tellerId: true } } },
    });
    if (!tranche) {
      return NextResponse.json({ error: "Payment tranche not found" }, { status: 404 });
    }
    if (tranche.paymentBatch.tellerId !== user.id && !user.isSystem) {
      return NextResponse.json(
        { error: "You are not the Teller assigned to this payment" },
        { status: 403 }
      );
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let uploaded;
    try {
      uploaded = await uploadObject({
        module: "payment/proofs",
        buffer,
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    } catch (err) {
      console.error("[POST /api/payment/proof-upload] storage upload failed", err);
      return NextResponse.json({ error: "File upload failed" }, { status: 500 });
    }

    const proof = await prisma.paymentProof.create({
      data: {
        paymentTrancheId: trancheId,
        fileName:         file.name,
        fileType:         file.type || "application/octet-stream",
        fileUrl:          uploaded.url,
        storageProvider:  uploaded.provider,
        storageKey:       uploaded.key,
        fileSize:         file.size,
        uploadedById:     user.id,
      },
    });

    return NextResponse.json({
      proofId:  proof.id,
      fileName: proof.fileName,
      fileUrl:  proof.fileUrl,
    });
  } catch (err: any) {
    console.error("[POST /api/payment/proof-upload]", err);
    return NextResponse.json(
      { error: err.message || "File upload failed" },
      { status: 500 }
    );
  }
}
