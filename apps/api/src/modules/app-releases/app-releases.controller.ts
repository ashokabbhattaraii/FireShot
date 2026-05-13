import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createHash } from "crypto";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { StorageService } from "../../common/storage/storage.service";
import { AppReleasesService } from "./app-releases.service";

@Controller("app")
export class PublicAppReleasesController {
  constructor(private svc: AppReleasesService) {}

  @Get("latest-release")
  latest() {
    return this.svc.getLatest();
  }

  @Get("stats")
  stats() {
    return this.svc.getPublicStats();
  }

  @Get("config")
  config(@Req() req: any) {
    return this.svc.getPublicConfig(req);
  }

  @Post("ci/register-release")
  async registerCiRelease(
    @Headers("x-ci-api-key") ciKey: string | undefined,
    @Body()
    body: {
      version: string;
      apkUrl: string;
      sha256?: string;
      releaseNotes?: string;
      fileSizeBytes?: number;
    },
  ) {
    const expected = process.env.CI_API_KEY;
    if (!expected || !ciKey || ciKey !== expected) {
      throw new UnauthorizedException("Invalid CI API key");
    }
    if (!body.version || !body.apkUrl) {
      throw new BadRequestException("version and apkUrl are required");
    }
    return this.svc.registerCiRelease(body);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/app-releases")
export class AppReleasesController {
  constructor(
    private svc: AppReleasesService,
    private storage: StorageService,
  ) {}

  @RequirePermission("config", "read")
  @Get("build-info")
  buildInfo(@Req() req: any) {
    return this.svc.getBuildInfo(req);
  }

  @RequirePermission("config", "read")
  @Get()
  list() {
    return this.svc.list();
  }

  @RequirePermission("config", "write")
  @Post("generate")
  generate(
    @Body() body: { version: string; releaseNotes?: string; runTests?: boolean },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.buildFromSource(
      {
        version: body.version,
        releaseNotes: body.releaseNotes,
        runTests: body.runTests !== false,
      },
      u.sub,
      req.ip,
      req,
    );
  }

  @RequirePermission("config", "write")
  @Post()
  @UseInterceptors(
    FileInterceptor("apk", {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { version: string; releaseNotes?: string; isLatest?: string; apkUrl?: string },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    if (!file && (!body.apkUrl || !/^https?:\/\//.test(body.apkUrl.trim()))) {
      throw new BadRequestException("Upload an APK file or provide a public APK URL.");
    }
    const url = file
      ? (await this.storage.upload(file, "releases", body.version)).url
      : body.apkUrl?.trim() ?? "";
    const sha256 = file?.buffer
      ? createHash("sha256").update(file.buffer).digest("hex")
      : undefined;
    return this.svc.create(
      {
        version: body.version,
        releaseNotes: body.releaseNotes,
        filename: url,
        isLatest: false,
        buildStatus: "UPLOADED",
        testStatus: "NOT_TESTED",
        fileSizeBytes: file?.size,
        sha256,
      },
      u.sub,
      req.ip,
    );
  }

  @RequirePermission("config", "write")
  @Post(":id/test")
  test(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.runSystemTests(id, u.sub, req.ip, req);
  }

  @RequirePermission("config", "write")
  @Put(":id/latest")
  setLatest(
    @Param("id") id: string,
    @Body() body: { isLatest: boolean },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.setLatest(id, !!body.isLatest, u.sub, req.ip);
  }
}
