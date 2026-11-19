import { getStorageConfig } from "../config";
import type { StorageProvider } from "../types";

export const s3StorageProvider: StorageProvider = {
  name: "s3",
  async upload() {
    throw notImplemented();
  },
  async read() {
    throw notImplemented();
  },
  async createReadStream() {
    throw notImplemented();
  },
  async delete() {
    throw notImplemented();
  },
  async exists() {
    throw notImplemented();
  },
  async getMetadata() {
    throw notImplemented();
  },
  async getDirectAccessUrl() {
    throw notImplemented();
  },
};

function notImplemented(): Error {
  const { provider } = getStorageConfig();
  return new Error(
    `STORAGE_PROVIDER is set to "${provider}" but the S3 provider is not implemented ` +
      `yet — see the header comment in lib/storage/providers/s3.ts for what's needed. ` +
      `Set STORAGE_PROVIDER=local until S3 support is actually built.`,
  );
}
