import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as AWS from "aws-sdk";
import { Readable } from "stream";
import * as crypto from "crypto";
import { IStorageService } from "./storage.interface";

@Injectable()
export class R2StorageService implements IStorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3: AWS.S3;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID")!;
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID")!;
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY")!;
    this.bucket = this.config.get<string>("R2_BUCKET", "visioncut-media");

    this.s3 = new AWS.S3({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      accessKeyId,
      secretAccessKey,
      signatureVersion: "v4",
      region: "auto",
    });
    this.publicBase = this.config.get<string>("R2_PUBLIC_URL", "");
  }

  async put(key: string, data: Buffer | string, contentType?: string): Promise<string> {
    const body = typeof data === "string" ? Buffer.from(data) : data;
    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
      .promise();
    return this.publicUrl(key);
  }

  async get(key: string): Promise<NodeJS.ReadableStream | null> {
    try {
      const res = await this.s3.getObject({ Bucket: this.bucket, Key: key }).promise();
      if (!res.Body) return null;
      return res.Body as Readable;
    } catch (e: any) {
      if (e?.code === "NoSuchKey") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }

  async presignedPutUrl(key: string, expiresIn: number): Promise<string> {
    return this.s3.getSignedUrl("putObject", {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
      ContentType: "application/octet-stream",
    });
  }

  async presignedGetUrl(key: string, expiresIn: number): Promise<string> {
    return this.s3.getSignedUrl("getObject", {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    });
  }

  publicUrl(key: string): string {
    if (this.publicBase) return `${this.publicBase}/${key}`;
    return `https://${this.bucket}.r2.cloudflarestorage.com/${key}`;
  }
}
