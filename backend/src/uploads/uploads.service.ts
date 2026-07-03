import { Inject, Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { IStorageService, STORAGE_SERVICE } from "../storage/storage.interface";

export type UploadKind = "reference" | "clip" | "music" | "sfx" | "voiceover";

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(@Inject(STORAGE_SERVICE) private readonly storage: IStorageService) {}

  private folder(kind: UploadKind): string {
    return kind === "reference" ? "reference" : kind === "clip" ? "clips" : kind;
  }

  private buildKey(userId: string, projectId: string, kind: UploadKind, filename: string): string {
    const ext = filename.split(".").pop() ?? "bin";
    return `${this.folder(kind)}/${userId}/${projectId}/${uuidv4()}.${ext}`;
  }

  async presign(
    userId: string,
    body: { kind: UploadKind; projectId: string; filename: string; contentType: string }
  ) {
    const key = this.buildKey(userId, body.projectId, body.kind, body.filename);
    const url = await this.storage.presignedPutUrl(key, 60 * 10);
    const publicUrl = this.storage.publicUrl(key);
    return { key, uploadUrl: url, publicUrl, expiresIn: 600 };
  }

  async putObject(
    userId: string,
    projectId: string,
    kind: UploadKind,
    file: Express.Multer.File
  ): Promise<string> {
    const key = this.buildKey(userId, projectId, kind, file.originalname);
    return this.storage.put(key, file.buffer, file.mimetype);
  }
}
