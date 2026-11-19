import type { Readable } from "stream";
import { getStorageConfig } from "./config";
import { generateStorageKey } from "./key";
import { localStorageProvider } from "./providers/local";
import { s3StorageProvider } from "./providers/s3";
import type { StorageProvider } from "./types";

export { generateStorageKey, assertSafeStorageKey } from "./key";

function getProvider(): StorageProvider {
  const { provider } = getStorageConfig();
  return provider === "s3" ? s3StorageProvider : localStorageProvider;
}

export function currentStorageProviderName(): "local" | "s3" {
  return getProvider().name;
}

export interface UploadObjectInput {
  module: string;
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
}

export interface UploadObjectResult {
  provider: "local" | "s3";
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export async function uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
  const key = generateStorageKey(input.module, input.originalFilename);
  const provider = getProvider();
  const result = await provider.upload({ key, buffer: input.buffer, mimeType: input.mimeType });
  const url = await buildFileUrl(result.key);
  return { provider: provider.name, key: result.key, url, size: result.size, mimeType: result.mimeType };
}

export async function replaceObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  await getProvider().upload({ key, buffer, mimeType });
}

export async function readObject(key: string): Promise<Buffer> {
  return getProvider().read(key);
}

export async function streamObject(key: string): Promise<Readable> {
  return getProvider().createReadStream(key);
}

export async function deleteObject(key: string): Promise<void> {
  return getProvider().delete(key);
}

export async function objectExists(key: string): Promise<boolean> {
  return getProvider().exists(key);
}

export async function getObjectMetadata(key: string) {
  return getProvider().getMetadata(key);
}

export async function buildFileUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string> {
  const provider = getProvider();
  const direct = await provider.getDirectAccessUrl(key, opts);
  if (direct) return direct;
  return `/api/files/${key}`;
}

export { getStorageConfig } from "./config";
