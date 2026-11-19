import path from "path";

export type StorageProviderName = "local" | "s3";

function readProviderName(): StorageProviderName {
  const raw = (process.env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  if (raw === "local" || raw === "s3") return raw;
  throw new Error(
    `Invalid STORAGE_PROVIDER "${raw}" — must be "local" or "s3". ` +
      `(S3 is reserved for future use; see lib/storage/providers/s3.ts.)`,
  );
}

export interface LocalStorageConfig {
  root: string;
}

let cachedLocalConfig: LocalStorageConfig | null = null;

export function getLocalStorageConfig(): LocalStorageConfig {
  if (cachedLocalConfig) return cachedLocalConfig;

  const raw = process.env.STORAGE_LOCAL_ROOT;
  if (!raw) {
    throw new Error(
      "STORAGE_LOCAL_ROOT is not set. Set it to an absolute path OUTSIDE " +
        "the project/public directory, e.g. STORAGE_LOCAL_ROOT=/var/data/addosser-uploads. " +
        "This directory must exist and be writable by the app process.",
    );
  }
  if (!path.isAbsolute(raw)) {
    throw new Error(
      `STORAGE_LOCAL_ROOT must be an absolute path (got "${raw}").`,
    );
  }

  cachedLocalConfig = { root: raw };
  return cachedLocalConfig;
}

export function getS3StorageConfig() {
  const bucket = process.env.STORAGE_S3_BUCKET;
  const region = process.env.STORAGE_S3_REGION;
  const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "STORAGE_PROVIDER=s3 requires STORAGE_S3_BUCKET, STORAGE_S3_REGION, " +
        "STORAGE_S3_ACCESS_KEY_ID, and STORAGE_S3_SECRET_ACCESS_KEY to all be set.",
    );
  }
  return { bucket, region, accessKeyId, secretAccessKey };
}

export interface StorageConfig {
  provider: StorageProviderName;
  defaultMaxUploadMb: number;
}

export function getStorageConfig(): StorageConfig {
  const provider = readProviderName();
  const defaultMaxUploadMb = Number(process.env.STORAGE_MAX_UPLOAD_MB ?? 25);
  return {
    provider,
    defaultMaxUploadMb: Number.isFinite(defaultMaxUploadMb) && defaultMaxUploadMb > 0
      ? defaultMaxUploadMb
      : 25,
  };
}
