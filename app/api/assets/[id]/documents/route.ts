import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { uploadObject }              from "@/lib/storage";
import { logAudit }                  from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { z }                         from "zod";

export const dynamic = "force-dynamic";

const DocSchema = z.object({
  documentType: z.enum(["PURCHASE_INVOICE","WARRANTY","MANUAL","CONTRACT","INSURANCE","PHOTO","OTHER"]),
  title:        z.string().min(1),
  fileBase64:   z.string().min(10),
  mimeType:     z.string().optional(),
  expiryDate:   z.string().optional(),
  notes:        z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasGranularPermission("assets", "documents", "view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const docs = await prisma.assetDocument.findMany({
    where:   { assetId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: docs });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit = await hasGranularPermission("assets", "documents", "create");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const body   = await req.json();
  const parsed = DocSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const { fileBase64, expiryDate, ...rest } = parsed.data;

  const match = /^data:([^;]+);base64,(.+)$/.exec(fileBase64);
  if (!match) {
    return NextResponse.json({ error: "fileBase64 must be a base64 data URL." }, { status: 400 });
  }
  const detectedMimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  let uploaded;
  try {
    uploaded = await uploadObject({
      module: "assets/documents",
      buffer,
      originalFilename: rest.title,
      mimeType: rest.mimeType || detectedMimeType,
    });
  } catch (err) {
    console.error("[POST /api/assets/:id/documents] storage upload failed", err);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }

  const doc = await prisma.assetDocument.create({
    data: {
      assetId:         params.id,
      fileUrl:         uploaded.url,
      storageProvider: uploaded.provider,
      storageKey:      uploaded.key,
      fileSize:        uploaded.size,
      mimeType:        uploaded.mimeType,
      expiryDate:      expiryDate ? new Date(expiryDate) : undefined,
      ...rest,
    },
  });

  await logAudit({
    userId:       (session.user as any).id,
    action:       "ASSET_DOCUMENT_ATTACHED",
    module:       "assets",
    resourceId:   params.id,
    resourceType: "Asset",
    afterData:    JSON.stringify({ documentType: rest.documentType, title: rest.title }),
  });

  return NextResponse.json({ success: true, data: doc }, { status: 201 });
}
