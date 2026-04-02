import fs from "node:fs";
import path from "node:path";

import type { StorageProvider } from "./storage.provider.js";

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async save(userId: string, uploadId: string, buffer: Buffer): Promise<string> {
    const dir = path.join(this.rootDir, userId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${uploadId}.csv`);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  readStream(storagePath: string): NodeJS.ReadableStream {
    return fs.createReadStream(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    await fs.promises.rm(storagePath, { force: true });
  }

  async readText(storagePath: string): Promise<string> {
    return fs.promises.readFile(storagePath, "utf-8");
  }
}

export function defaultUploadsRoot(): string {
  return path.join(process.cwd(), "uploads");
}
