import { promises as fs } from "fs";
import path from "path";
import { getEnv } from "./env";

export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  url(key: string): string;
}

class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly dir: string) {}

  private resolve(key: string): string {
    // Guard against path traversal — keys are generated server-side, but
    // never trust a joined path blindly.
    const resolved = path.resolve(this.dir, key);
    const base = path.resolve(this.dir);
    if (!resolved.startsWith(base)) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  url(key: string): string {
    // Served through /api/files/[...key], never directly from disk. `key` is
    // "<userId>/<file>" — each segment is encoded individually so a literal
    // "/" in the key stays a real path separator, not a decoded "%2F".
    return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}

class S3StorageAdapter implements StorageAdapter {
  // Minimal S3-compatible adapter (AWS S3, Cloudflare R2, MinIO, Backblaze B2...).
  // Implemented with a plain HTTP PUT/GET using presigned-style env creds is
  // out of scope for the scaffold — wire up @aws-sdk/client-s3 here if you
  // need S3 storage. See BUILD_SPEC.md "File storage".
  put(): Promise<void> {
    throw new Error("S3 storage adapter is not implemented yet — see BUILD_SPEC.md.");
  }
  get(): Promise<Buffer> {
    throw new Error("S3 storage adapter is not implemented yet — see BUILD_SPEC.md.");
  }
  url(): string {
    throw new Error("S3 storage adapter is not implemented yet — see BUILD_SPEC.md.");
  }
}

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const env = getEnv();
  cached =
    env.STORAGE_DRIVER === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter(env.STORAGE_LOCAL_DIR);
  return cached;
}
