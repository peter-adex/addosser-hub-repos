import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { streamObject, getObjectMetadata, assertSafeStorageKey } from "@/lib/storage";
import { checkAccess, type AccessResult } from "@/lib/file-access";

export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  const key = (params.key ?? []).join("/");

  try {
    assertSafeStorageKey(key);
  } catch {
    return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
  }

  let access: AccessResult;
  try {
    access = await checkAccess(key);
  } catch (err) {
    console.error("[GET /api/files]", err);
    return NextResponse.json({ error: "Could not verify access to this file" }, { status: 500 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: access.error ?? "Forbidden" }, { status: access.status ?? 403 });
  }

  const meta = await getObjectMetadata(key);
  if (!meta) return NextResponse.json({ error: "File not found" }, { status: 404 });

  let nodeStream: Readable;
  try {
    nodeStream = await streamObject(key);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", access.mimeType || "application/octet-stream");
  headers.set("Content-Length", String(meta.size));
  headers.set("Cache-Control", "private, no-store");
  if (access.fileName) {
    const safeName = access.fileName.replace(/["\r\n]/g, "");
    headers.set("Content-Disposition", `inline; filename="${safeName}"`);
  }

  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, { headers });
}
