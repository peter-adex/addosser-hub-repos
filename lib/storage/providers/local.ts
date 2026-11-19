import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Readable } from "stream";
import { getLocalStorageConfig } from "../config";
import { assertSafeStorageKey } from "../key";
import type { StorageProvider, StoredObjectMeta } from "../types";

function resolvePath(key: string): string {
  assertSafeStorageKey(key);
  const { root } = getLocalStorageConfig();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw new Error(`Storage key resolves outside the storage root: "${key}"`);
  }
  return resolved;
}

async function ensureDirFor(filePath: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

export const localStorageProvider: StorageProvider = {
  name: "local",

  async upload({ key, buffer, mimeType }): Promise<StoredObjectMeta> {
    const target = resolvePath(key);
    await ensureDirFor(target);

    const tmpPath = `${target}.tmp-${crypto.randomBytes(6).toString("hex")}`;
    try {
      await fsp.writeFile(tmpPath, buffer);
      await fsp.rename(tmpPath, target);
    } catch (err) {
      await fsp.rm(tmpPath, { force: true }).catch(() => {});
      throw new Error(
        `Local storage write failed for key "${key}": ${(err as Error).message}`,
      );
    }

    return { key, size: buffer.length, mimeType };
  },

  async read(key: string): Promise<Buffer> {
    const target = resolvePath(key);
    try {
      return await fsp.readFile(target);
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new Error(`File not found in local storage: "${key}"`);
      }
      throw new Error(`Local storage read failed for key "${key}": ${err.message}`);
    }
  },

  async createReadStream(key: string): Promise<Readable> {
    const target = resolvePath(key);
    try {
      await fsp.access(target, fs.constants.R_OK);
    } catch {
      throw new Error(`File not found in local storage: "${key}"`);
    }
    return fs.createReadStream(target);
  },

  async delete(key: string): Promise<void> {
    const target = resolvePath(key);
    try {
      await fsp.unlink(target);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw new Error(`Local storage delete failed for key "${key}": ${err.message}`);
      }
    }
  },

  async exists(key: string): Promise<boolean> {
    const target = resolvePath(key);
    try {
      await fsp.access(target, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  },

  async getMetadata(key: string) {
    const target = resolvePath(key);
    try {
      const stat = await fsp.stat(target);
      return { size: stat.size, mtime: stat.mtime };
    } catch (err: any) {
      if (err?.code === "ENOENT") return null;
      throw err;
    }
  },

  async getDirectAccessUrl(): Promise<string | null> {
    return null;
  },
};
