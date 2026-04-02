export interface StorageProvider {
  save(userId: string, uploadId: string, buffer: Buffer): Promise<string>;
  readStream(storagePath: string): NodeJS.ReadableStream;
  delete(storagePath: string): Promise<void>;
}
