import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkAccess } from "@/lib/file-access";
import {
  readObject,
  getObjectMetadata,
  assertSafeStorageKey,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = ["res.cloudinary.com", "cloudinary.com"];

const MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "text/plain": ".txt",
  "text/html": ".html",
  "text/csv": ".csv",
  "application/zip": ".zip",
  "application/octet-stream": "",
};

function addExtensionIfMissing(filename: string, mimeType: string): string {
  if (/\.[a-zA-Z0-9]{2,5}$/.test(filename)) return filename;
  const ext = MIME_EXT[mimeType.split(";")[0].trim()] ?? "";
  return filename + ext;
}

function sanitizeForHeader(name: string): string {
  return name
    .replace(/[^\w\s\-_.()[\]]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const encodedUrl = searchParams.get("url");
  const rawName = searchParams.get("name") ?? "";

  if (!encodedUrl) {
    return NextResponse.json(
      { error: "Missing required parameter: url" },
      { status: 400 },
    );
  }

  let fileUrl: string;

  try {
    fileUrl = decodeURIComponent(encodedUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid url parameter" },
      { status: 400 },
    );
  }

  if (fileUrl.startsWith("/api/files/")) {
    const key = fileUrl.slice("/api/files/".length);
    try {
      assertSafeStorageKey(key);
    } catch {
      return NextResponse.json(
        { error: "Invalid file reference" },
        { status: 400 },
      );
    }

    const access = await checkAccess(key);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error ?? "Forbidden" },
        { status: access.status ?? 403 },
      );
    }

    const meta = await getObjectMetadata(key);
    if (!meta)
      return NextResponse.json({ error: "File not found" }, { status: 404 });

    let buffer: Buffer;
    try {
      buffer = await readObject(key);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let filename = decodeURIComponent(rawName).trim();
    if (!filename) filename = key.split("/").pop() ?? "download";
    filename = sanitizeForHeader(filename);
    const contentType = access.mimeType || "application/octet-stream";
    filename = addExtensionIfMissing(filename, contentType);

    const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
    const utf8 = encodeURIComponent(filename).replace(/'/g, "%27");
    const disposition = `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Content-Length": String(meta.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return NextResponse.json({ error: "Malformed file URL" }, { status: 400 });
  }

  const hostAllowed = ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith("." + h),
  );
  if (!hostAllowed) {
    return NextResponse.json(
      { error: "File host not permitted" },
      { status: 403 },
    );
  }

  let fetchUrl = fileUrl;
  if (
    fileUrl.includes("/image/upload/") &&
    !fileUrl.includes("fl_attachment")
  ) {
    fetchUrl = fileUrl.replace(
      "/image/upload/",
      "/image/upload/fl_attachment/",
    );
  }

  let upstream: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    upstream = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timer);
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    console.error("[download] fetch failed:", err?.message);
    return NextResponse.json(
      {
        error: isTimeout
          ? "File download timed out — try again"
          : "Could not retrieve the file from storage",
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    console.error(`[download] upstream ${upstream.status} for: ${fetchUrl}`);
    return NextResponse.json(
      {
        error:
          upstream.status === 404
            ? "File not found in storage"
            : `Storage returned an error (${upstream.status})`,
      },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";

  let filename = decodeURIComponent(rawName).trim();
  if (!filename) {
    const segments = parsed.pathname.split("/");
    const last = segments[segments.length - 1] ?? "download";
    filename = last.replace(/^v\d+_/, "").replace(/_/g, " ");
  }
  filename = sanitizeForHeader(filename);
  filename = addExtensionIfMissing(filename, contentType);

  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const utf8 = encodeURIComponent(filename).replace(/'/g, "%27");
  const disposition = `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;

  let buffer: ArrayBuffer;
  try {
    buffer = await upstream.arrayBuffer();

    console.log("Downloaded Bytes:", buffer.byteLength);
  } catch (err: any) {
    console.error("[download] arrayBuffer() failed:", err?.message);
    return NextResponse.json(
      { error: "Failed to read file data from storage" },
      { status: 502 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Content-Length": String(buffer.byteLength),
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };

  return new NextResponse(buffer, { status: 200, headers });
}
