import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { StorageService } from "../../common/storage/storage.service";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "../admin/admin-action-log.service";

export interface BannerDto {
  title?: string;
  subtitle?: string | null;
  imageUrl?: string;
  mobileImageUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  autoSlide?: boolean;
}

@Injectable()
export class BannersService {
  private activeCache: { expiresAt: number; data: any[] } | null = null;

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
    private storage: StorageService,
  ) {}

  async getActiveBanners() {
    const now = Date.now();
    if (this.activeCache && this.activeCache.expiresAt > now) return this.activeCache.data;
    const data = await this.queryActive();
    this.activeCache = { data, expiresAt: now + 60_000 };
    return data;
  }

  getAll() {
    return this.prisma.heroBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async create(dto: BannerDto, adminId: string, ip?: string | null) {
    const data = this.normalize(dto, true);
    const created = await this.prisma.heroBanner.create({ data });
    this.invalidate();
    await this.logs.log(adminId, "hero_banner.create", "hero_banner", created.id, null, created, ip);
    return created;
  }

  async update(id: string, dto: BannerDto, adminId: string, ip?: string | null) {
    const oldValue = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!oldValue) throw new NotFoundException("Banner not found");
    const updated = await this.prisma.heroBanner.update({
      where: { id },
      data: this.normalize(dto, false),
    });
    this.invalidate();
    await this.logs.log(adminId, "hero_banner.update", "hero_banner", id, oldValue, updated, ip);
    return updated;
  }

  async remove(id: string, adminId: string, ip?: string | null) {
    const oldValue = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!oldValue) throw new NotFoundException("Banner not found");
    await this.prisma.heroBanner.delete({ where: { id } });
    this.invalidate();
    await this.logs.log(adminId, "hero_banner.delete", "hero_banner", id, oldValue, null, ip);
    return { ok: true };
  }

  async reorder(orders: { id: string; sortOrder: number }[], adminId: string, ip?: string | null) {
    await this.prisma.$transaction(
      orders.map((item) =>
        this.prisma.heroBanner.update({
          where: { id: item.id },
          data: { sortOrder: Number(item.sortOrder) || 0 },
        }),
      ),
    );
    this.invalidate();
    await this.logs.log(adminId, "hero_banner.reorder", "hero_banner", null, null, { orders }, ip);
    return this.getAll();
  }

  async toggle(id: string, adminId: string, ip?: string | null) {
    const banner = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException("Banner not found");
    return this.update(id, { isActive: !banner.isActive }, adminId, ip);
  }

  async uploadImage(
    id: string,
    file: Express.Multer.File,
    adminId: string,
    ip?: string | null,
    variant: "desktop" | "mobile" = "desktop",
  ) {
    if (!file) throw new BadRequestException("Image file is required");
    if (!file.mimetype?.startsWith("image/")) {
      throw new BadRequestException("Only image uploads are allowed");
    }
    const banner = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException("Banner not found");

    const imageUrl = await this.uploadBannerFile(id, file, variant);
    const data = variant === "mobile" ? { mobileImageUrl: imageUrl } : { imageUrl };
    const updated = await this.prisma.heroBanner.update({ where: { id }, data });
    this.invalidate();
    await this.logs.log(adminId, "hero_banner.upload", "hero_banner", id, banner, updated, ip);
    return updated;
  }

  private queryActive() {
    return this.prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  private invalidate() {
    this.activeCache = null;
  }

  private normalize(dto: BannerDto, isCreate: boolean) {
    const data: any = {};
    if (isCreate || dto.title !== undefined) {
      const title = dto.title?.trim();
      if (!title) throw new BadRequestException("Title is required");
      data.title = title;
    }
    if (isCreate || dto.imageUrl !== undefined) {
      const imageUrl = dto.imageUrl?.trim();
      if (!imageUrl) throw new BadRequestException("Image URL is required");
      data.imageUrl = imageUrl;
    }
    for (const key of ["subtitle", "mobileImageUrl", "ctaText", "ctaLink", "badgeText", "badgeColor"] as const) {
      if (dto[key] !== undefined) data[key] = dto[key]?.trim() || null;
    }
    if (dto.isActive !== undefined) data.isActive = !!dto.isActive;
    if (dto.autoSlide !== undefined) data.autoSlide = !!dto.autoSlide;
    if (dto.sortOrder !== undefined) data.sortOrder = Number(dto.sortOrder) || 0;
    return data;
  }

  private bannerDirs() {
    const root = this.repoRoot();
    return [
      join(root, "apps/api/public/banners"),
      join(root, "public/banners"),
    ];
  }

  private async uploadBannerFile(
    id: string,
    file: Express.Multer.File,
    variant: "desktop" | "mobile",
  ) {
    try {
      const uploaded = await this.storage.upload(file, "banners", `${id}-${variant}`);
      return uploaded.url;
    } catch {
      const filename = variant === "mobile" ? `${id}-mobile.jpg` : `${id}.jpg`;
      await Promise.all(
        this.bannerDirs().map(async (dir) => {
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, filename), file.buffer);
        }),
      );
      return `/banners/${filename}`;
    }
  }

  private repoRoot() {
    if (process.env.REPO_ROOT) return resolve(process.env.REPO_ROOT);
    let dir = process.cwd();
    for (let i = 0; i < 8; i += 1) {
      if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
    return resolve(process.cwd(), "../..");
  }
}
