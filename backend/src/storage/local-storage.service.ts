import { Injectable, Logger } from "@nestjs/common";
import { createReadStream, existsSync } from "fs";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, resolve, sep } from "path";
import * as crypto from "crypto";
import { IStorageService } from "./storage.interface";

const ROOT = resolve(process.cwd(), "storage");
const PUBLIC_BASE = process.env.R2_PUBLIC_URL ?? "http://localhost:3001/media";

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  private fullPath(key: string): string {
    // prevent path traversal: keys must be relative
    const safe = key.replace(/^[/\\]+/, "").split(/[/\\]/).join(sep);
    return join(ROOT, safe);
  }

  async put(key: string, data: Buffer | string, _contentType?: string): Promise<string> {
    const path = this.fullPath(key);
    await mkdir(join(path, ".."), { recursive: true });
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    await writeFile(path, buf);
    return this.publicUrl(key);
  }

  async get(key: string): Promise<NodeJS.ReadableStream | null> {
    const path = this.fullPath(key);
    if (!existsSync(path)) return null;
    return createReadStream(path);
  }

  async delete(key: string): Promise<void> {
    const path = this.fullPath(key);
    if (existsSync(path)) await unlink(path);
  }

  async presignedPutUrl(key: string, _expiresIn: number): Promise<string> {
    // Local dev: clients POST directly to /uploads/* with the key as a hint
    return `${PUBLIC_BASE}/${key}`;
  }

  async presignedGetUrl(key: string, _expiresIn: number): Promise<string> {
    return this.publicUrl(key);
  }

  publicUrl(key: string): string {
    return `${PUBLIC_BASE}/${key}`;
  }

  /** Helper for tests / scripts to know where files live. */
  static resolveRoot(): string {
    return ROOT;
  }
}
