import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UploadsService, UploadKind } from "./uploads.service";
import { PrismaService } from "../prisma/prisma.service";
import { ClipType } from "@prisma/client";

const ALLOWED_KINDS: UploadKind[] = ["reference", "clip", "music", "sfx", "voiceover"];

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly prisma: PrismaService
  ) {}

  /** Presign a put URL so the client can upload directly to R2. */
  @Post("presign")
  async presign(
    @CurrentUser() user: { id: string },
    @Body() body: { kind: UploadKind; projectId: string; filename: string; contentType: string }
  ) {
    if (!ALLOWED_KINDS.includes(body.kind)) {
      throw new BadRequestException(`Invalid kind. Allowed: ${ALLOWED_KINDS.join(", ")}`);
    }
    return this.uploads.presign(user.id, body);
  }

  /** Multipart fallback upload — used in local dev without R2 credentials. */
  @Post(":kind")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @CurrentUser() user: { id: string },
    @Body() body: { projectId: string },
    @UploadedFile() file: Express.Multer.File,
    @Body("kind") _kind: string,
    @Inject("KIND") _raw: any
  ) {
    // The :kind route param is decoded by Nest; pull it from the URL via @Param instead.
    return this.handleUpload(user.id, body, file, _kind as UploadKind);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async uploadGeneric(
    @CurrentUser() user: { id: string },
    @Body() body: { projectId: string; kind: UploadKind },
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!ALLOWED_KINDS.includes(body.kind)) {
      throw new BadRequestException(`Invalid kind. Allowed: ${ALLOWED_KINDS.join(", ")}`);
    }
    return this.handleUpload(user.id, body, file, body.kind);
  }

  private async handleUpload(
    userId: string,
    body: { projectId: string },
    file: Express.Multer.File,
    kind: UploadKind
  ) {
    if (!file) throw new BadRequestException("Missing file");
    const project = await this.prisma.project.findFirst({
      where: { id: body.projectId, userId },
    });
    if (!project) throw new BadRequestException("Project not found or not owned");

    const url = await this.uploads.putObject(userId, body.projectId, kind, file);
    const clipType = this.toClipType(kind);

    const clip = await this.prisma.clip.create({
      data: {
        projectId: project.id,
        name: file.originalname,
        url,
        type: clipType,
        sizeBytes: BigInt(file.size),
        mimeType: file.mimetype,
      },
    });

    if (kind === "reference") {
      await this.prisma.project.update({
        where: { id: project.id },
        data: { referenceUrl: url },
      });
    }

    return { clip, url };
  }

  private toClipType(kind: UploadKind): ClipType {
    switch (kind) {
      case "reference":
      case "clip":
        return kind === "reference" ? ClipType.reference : ClipType.user;
      case "music":
        return ClipType.music;
      case "sfx":
        return ClipType.sfx;
      case "voiceover":
        return ClipType.voiceover;
    }
  }
}
