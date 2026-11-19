import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadPaymentProof } from "@/lib/payment-v2";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.process && !user.isSystem) {
      return NextResponse.json(
        { error: "You do not have permission to upload payment proofs." },
        { status: 403 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Upload must be sent as multipart/form-data, not JSON. " +
            "Ensure your request uses FormData and does NOT set Content-Type manually.",
        },
        { status: 400 }
      );
    }

    const trancheId = formData.get("trancheId");
    const file = formData.get("file");

    if (!trancheId || typeof trancheId !== "string") {
      return NextResponse.json(
        { error: "trancheId is required" },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A file must be included in the upload" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 20 MB limit.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadPaymentProof({
      trancheId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileBuffer: buffer,
      fileSize: file.size,
      uploadedById: user.id,
      uploadedByRole: user.roleName,
    });

    return NextResponse.json(
      {
        success: true,
        proofId: result.proofId,
        fileUrl: result.fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/payment/proof-upload]", err);
    return NextResponse.json(
      { error: err.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
