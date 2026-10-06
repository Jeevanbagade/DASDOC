/**
 * File storage abstraction.
 *
 * Dev: LocalDiskStorage writes under STORAGE_DIR (default `.storage/`).
 * Prod: STORAGE_DRIVER=s3 swaps in an S3-compatible driver — the seam is
 * the StorageDriver interface; upload routes/services never touch the fs.
 */
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "./env";

export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LocalDiskStorage implements StorageDriver {
  readonly name = "local";
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(process.cwd(), rootDir);
  }

  private resolve(key: string): string {
    // Path traversal guard: storage keys are server-generated, but double-check.
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // best effort — orphan bytes are cheaper than a 500 on delete
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * SEAM for production: S3-compatible object storage (AWS S3, MinIO,
 * Cloudflare R2). Implement `put/delete/exists` with the AWS SDK v3 client,
 * reading credentials from env (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY). Everything upstream (routes, services) stays
 * identical because they only depend on StorageDriver.
 */
class S3Storage implements StorageDriver {
  readonly name = "s3";
  constructor(opts: { bucket: string; endpoint?: string }) {
    void opts;
  }
  async put(): Promise<void> {
    throw new Error("S3 storage driver is not configured yet — set STORAGE_DRIVER=local or implement src/server/storage.ts#S3Storage");
  }
  async delete(): Promise<void> {
    throw new Error("S3 storage driver is not configured yet");
  }
  async exists(): Promise<boolean> {
    throw new Error("S3 storage driver is not configured yet");
  }
}

let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (cached) return cached;
  cached =
    serverEnv.storageDriver === "s3"
      ? new S3Storage({ bucket: process.env.S3_BUCKET ?? "docdash" })
      : new LocalDiskStorage(serverEnv.storageDir);
  return cached;
}

/** Server-generated, collision-safe storage key. */
export function storageKeyFor(userId: string, documentId: string, ext: string): string {
  return `${userId}/${documentId}${ext ? `.${ext}` : ""}`;
}
