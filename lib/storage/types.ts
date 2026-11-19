import type { Readable } from "stream";

export interface StoredObjectMeta {
  key: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  readonly name: "local" | "s3";

  upload(input: { key: string; buffer: Buffer; mimeType: string }): Promise<StoredObjectMeta>;

  read(key: string): Promise<Buffer>;

  createReadStream(key: string): Promise<Readable>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  getMetadata(key: string): Promise<{ size: number; mtime: Date } | null>;

  getDirectAccessUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string | null>;
}
