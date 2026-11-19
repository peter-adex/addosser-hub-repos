import { NextRequest } from "next/server";
import {
  getRequiredSession,
  successResponse,
  errorResponse,
} from "@/lib/api-helpers";
import { uploadObject } from "@/lib/storage";

const STORAGE_MODULE: Record<string, string> = {
  drivers: "fleet/drivers",
  vehicles: "fleet/vehicles",
  "vehicle-docs": "fleet/vehicle-docs",
  "work-orders": "fleet/work-orders",
  appraisals: "fleet/appraisals",
};

const ALLOWED_TYPES: Record<string, string[]> = {
  drivers: ["image/jpeg", "image/png", "image/webp"],

  vehicles: ["image/jpeg", "image/png", "image/webp"],

  "vehicle-docs": [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],

  "work-orders": [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "message/rfc822",
  ],

  appraisals: ["application/pdf"],
};

const MAX_SIZE_BYTES: Record<string, number> = {
  drivers: 2 * 1024 * 1024,
  vehicles: 5 * 1024 * 1024,
  "vehicle-docs": 20 * 1024 * 1024,
  "work-orders": 10 * 1024 * 1024,
  appraisals: 10 * 1024 * 1024,
};

const FOLDER_LABELS: Record<string, string> = {
  drivers: "Driver photos",
  vehicles: "Vehicle photos",
  "vehicle-docs": "Vehicle documents",
  "work-orders": "Work order attachments",
  appraisals: "Appraisal documents",
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "text/plain": "TXT",
  "message/rfc822": "EML",
};

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();
  if (!session) return errorResponse("Unauthorized", 401);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) ?? "vehicles";
    const filename = formData.get("filename") as string | null;

    if (!file) {
      return errorResponse(
        "No file provided. Send the file as FormData field 'file'.",
        400,
      );
    }

    const allowed = ALLOWED_TYPES[folder] ?? ALLOWED_TYPES.vehicles;
    const maxSize = MAX_SIZE_BYTES[folder] ?? 5 * 1024 * 1024;
    const label = FOLDER_LABELS[folder] ?? folder;

    if (!allowed.includes(file.type)) {
      const friendlyTypes = allowed.map((t) => MIME_TO_EXT[t] ?? t).join(", ");
      return errorResponse(
        `File type not allowed for ${label}. Accepted formats: ${friendlyTypes}`,
        415,
      );
    }

    if (file.size > maxSize) {
      return errorResponse(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
          `Maximum for ${label} is ${(maxSize / 1024 / 1024).toFixed(0)} MB.`,
        413,
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let uploaded;
    try {
      uploaded = await uploadObject({
        module: STORAGE_MODULE[folder] ?? STORAGE_MODULE.vehicles,
        buffer,
        originalFilename: filename || file.name,
        mimeType: file.type,
      });
    } catch (err) {
      console.error("[POST /api/fleet/upload] storage upload failed", err);
      return errorResponse("Upload failed. Check your storage configuration.", 500);
    }

    return successResponse(
      {
        url: uploaded.url,
        storageProvider: uploaded.provider,
        storageKey: uploaded.key,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
      201,
    );
  } catch (err) {
    console.error("[POST /api/fleet/upload]", err);
    return errorResponse(
      "Upload failed. Check your storage configuration.",
      500,
    );
  }
}
