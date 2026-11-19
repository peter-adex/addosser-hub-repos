import crypto from "crypto";
import path from "path";

function safeExtension(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (!/^\.[a-z0-9]{1,10}$/.test(ext)) return "";
  return ext;
}

function safeModuleSegment(segment: string): string {
  const cleaned = segment.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!cleaned) throw new Error(`Invalid storage module segment: "${segment}"`);
  return cleaned;
}

export function generateStorageKey(module: string, originalFilename: string): string {
  const segments = module.split("/").map(safeModuleSegment);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = crypto.randomBytes(16).toString("hex");
  const ext = safeExtension(originalFilename);
  return [...segments, String(yyyy), mm, `${id}${ext}`].join("/");
}

export function assertSafeStorageKey(key: string): void {
  if (
    !key ||
    key.includes("\0") ||
    key.includes("..") ||
    path.isAbsolute(key) ||
    key.startsWith("~")
  ) {
    throw new Error(`Refusing unsafe storage key: "${key}"`);
  }
}
