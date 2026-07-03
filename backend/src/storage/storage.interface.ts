export const STORAGE_SERVICE = "STORAGE_SERVICE";

export interface IStorageService {
  /** Save a Buffer or local-path file under `key` and return the public URL. */
  put(key: string, data: Buffer | string, contentType?: string): Promise<string>;
  /** Get a readable stream for the key, or null if missing. */
  get(key: string): Promise<NodeJS.ReadableStream | null>;
  /** Delete an object. */
  delete(key: string): Promise<void>;
  /** Generate a presigned URL valid for `expiresIn` seconds. */
  presignedPutUrl(key: string, expiresIn: number): Promise<string>;
  presignedGetUrl(key: string, expiresIn: number): Promise<string>;
  /** Resolve a public URL for a stored key. */
  publicUrl(key: string): string;
}
