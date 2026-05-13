import { Controller, Get, Inject, Param, Put, Post, Body, UseGuards, Req, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppConfigService } from './app-config.service';
import { PRISMA } from '../../prisma/prisma.module';
import { PrismaClient } from '@fireslot/db';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Role } from '@fireslot/db';
import { StorageService } from '../../common/storage/storage.service';

@Controller()
export class AppConfigController {
  private readonly logger = new Logger("ClientLog");

  constructor(
    private svc: AppConfigService,
    @Inject(PRISMA) private prisma: PrismaClient,
    private storage: StorageService,
  ) {}

  @Get('app/config')
  async publicConfig(@Req() req: any) {
    const appConfig = await this.svc.getPublic();
    const systemRows = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            "APP_MAINTENANCE_ENABLED",
            "MAINTENANCE_MODE",
            "APP_MAINTENANCE_MESSAGE",
            "APP_FORCE_UPDATE_ENABLED",
            "APP_MIN_ANDROID_VERSION",
            "APP_LATEST_VERSION",
            "APP_DOWNLOAD_ENABLED",
            "APP_SUPPORT_URL",
            "APP_ANNOUNCEMENT_ACTIVE",
            "APP_ANNOUNCEMENT_TEXT",
            "APP_ANNOUNCEMENT_COLOR",
          ],
        },
      },
    });
    const system = Object.fromEntries(systemRows.map((row) => [row.key, row.value]));
    const latest = await this.prisma.appRelease.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: "desc" },
    });
    const latestVersion = latest?.version ?? system.APP_LATEST_VERSION ?? "1.0.0";
    const downloadUrl = latest?.filename ? this.publicDownloadUrl(latest.filename, req) : null;

    return {
      ...appConfig,
      ...system,
      maintenance: {
        enabled:
          this.configFlag(system.APP_MAINTENANCE_ENABLED) ||
          this.configFlag(system.MAINTENANCE_MODE),
        message:
          system.APP_MAINTENANCE_MESSAGE ??
          "FireSlot Nepal is updating. Please try again soon.",
      },
      announcement: {
        active: this.configFlag(system.APP_ANNOUNCEMENT_ACTIVE),
        text: system.APP_ANNOUNCEMENT_TEXT ?? "",
        color: system.APP_ANNOUNCEMENT_COLOR ?? "#E53935",
      },
      update: {
        force: this.configFlag(system.APP_FORCE_UPDATE_ENABLED),
        minAndroidVersion: system.APP_MIN_ANDROID_VERSION ?? "1.0.0",
        latestVersion,
        downloadEnabled: system.APP_DOWNLOAD_ENABLED === undefined
          ? true
          : this.configFlag(system.APP_DOWNLOAD_ENABLED),
        downloadUrl,
      },
      urls: {
        api: process.env.NEXT_PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? null,
        publicWeb: process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_WEB_URL ?? null,
        support: system.APP_SUPPORT_URL ?? "/support",
      },
      native: { loadMode: process.env.NATIVE_LOAD_MODE === "bundled" ? "bundled" : "remote" },
    };
  }

  @Post('app/client-log')
  clientLog(@Body() body: any, @Req() req: any) {
    const safe = {
      event: String(body?.event ?? "unknown").slice(0, 80),
      at: String(body?.at ?? new Date().toISOString()).slice(0, 40),
      href: String(body?.href ?? "").slice(0, 300),
      native: Boolean(body?.native),
      details: JSON.stringify(body?.details ?? {}).slice(0, 1000),
      ip: req.ip,
      ua: String(req.headers["user-agent"] ?? "").slice(0, 220),
    };
    this.logger.warn(JSON.stringify(safe));
    return { ok: true };
  }

  private configFlag(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return false;
    return value.toLowerCase() === "true";
  }

  private publicDownloadUrl(filename: string, req: any) {
    if (/^https?:\/\//i.test(filename)) return filename;
    const clean = filename.trim().replace(/^\/+/, "").replace(/^(downloads\/)+/, "");
    if (!clean) return null;
    const path = `/downloads/${clean}`;
    const configured =
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.PUBLIC_API_URL ??
      null;
    const base = this.apiBase(configured) ?? this.requestBase(req);
    return base ? `${base}${path}` : path;
  }

  private apiBase(value?: string | null) {
    const clean = value?.trim().replace(/\/+$/, "");
    if (!clean) return null;
    return clean.replace(/\/api$/, "");
  }

  private requestBase(req: any) {
    const host = String(req?.headers?.["x-forwarded-host"] ?? req?.headers?.host ?? "")
      .split(",")[0]
      .trim();
    if (!host) return null;
    const proto = String(req?.headers?.["x-forwarded-proto"] ?? req?.protocol ?? "https")
      .split(",")[0]
      .trim();
    return `${proto}://${host}`;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/app-config')
  async adminGetAll() {
    return this.svc.getAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put('admin/app-config/:key')
  async set(@Param('key') key: string, @Body() body: { value: string }, @Req() req: any) {
    const adminId = req.user?.sub ?? 'system';
    return this.svc.set(key, body.value, adminId, req.ip);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/app-config/upload-qr')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadQr(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { method: string },
    @Req() req: any,
  ) {
    if (!file) throw new Error('No file uploaded');
    const method = body.method || 'esewa';
    const result = await this.storage.upload(file, 'config', `qr-${method}`);
    const key = `deposit_qr_${method}`;
    const adminId = req.user?.sub ?? 'system';
    await this.svc.set(key, result.url, adminId, req.ip);
    return { key, url: result.url };
  }
}
