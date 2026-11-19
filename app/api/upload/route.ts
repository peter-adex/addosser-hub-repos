import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
<<<<<<< HEAD
import { uploadObject } from "@/lib/storage";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

const UploadSchema = z.object({
  file: z.string().min(10),
  folder: z.string().min(1),
  publicId: z.string().optional(),
});

const STORAGE_MODULE: Record<string, string> = {
  avatars: "avatars",
  assets: "assets/photos",
  "assets/movements": "assets/movements",
  "invoices/attachments": "invoices/attachments",
  "vendor-contracts": "vendor-contracts",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON or empty request stream payload" },
      { status: 400 },
    );
  }

  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { file, folder } = parsed.data;
=======
import { uploadFile } from "@/lib/cloudinary";
import { z } from "zod";

const UploadSchema = z.object({
  file: z.string().min(10),         // base64 data URL
  folder: z.string().min(1),        // e.g. "avatars", "assets", "invoices"
  publicId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { file, folder, publicId } = parsed.data;
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const maxSizeMB = 10;
  const base64Size = (file.length * 3) / 4 / 1024 / 1024;
  if (base64Size > maxSizeMB) {
<<<<<<< HEAD
    return NextResponse.json(
      { error: `File too large. Max ${maxSizeMB}MB allowed.` },
      { status: 413 },
    );
  }

  const match = /^data:([^;]+);base64,(.+)$/.exec(file);
  if (!match) {
    return NextResponse.json(
      { error: "file must be a base64 data URL." },
      { status: 400 },
    );
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  try {
    const result = await uploadObject({
      module: STORAGE_MODULE[folder] ?? folder,
      buffer,
      originalFilename: `upload.${mimeType.split("/")[1] ?? "bin"}`,
      mimeType,
    });
    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        storageProvider: result.provider,
        storageKey: result.key,
        size: result.size,
        mimeType: result.mimeType,
      },
    });
  } catch (uploadError: any) {
    console.error("[POST /api/upload] storage upload failed", uploadError);
    return NextResponse.json(
      {
        error: "File upload failed",
        details: uploadError?.message || "Storage service error",
      },
      { status: 500 },
    );
  }
=======
    return NextResponse.json({ error: `File too large. Max ${maxSizeMB}MB allowed.` }, { status: 413 });
  }

  const result = await uploadFile(file, folder, publicId);
  return NextResponse.json({ success: true, data: result });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
