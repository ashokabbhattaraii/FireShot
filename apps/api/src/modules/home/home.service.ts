import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { MemoryCacheService } from "../../common/cache/memory-cache.service";

const HOME_CACHE_KEY = "home:public";
const HOME_TTL = 30; // seconds

@Injectable()
export class HomeService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private cache: MemoryCacheService,
  ) {}

  getHomeData() {
    return this.cache.getOrSet(HOME_CACHE_KEY, HOME_TTL, () => this.loadHomeData());
  }

  private async loadHomeData() {
    const [tournaments, challenges, categories, stats, banners] = await Promise.all([
      this.loadTournaments(),
      this.loadChallenges(),
      this.loadCategories(),
      this.loadStats(),
      this.loadBanners(),
    ]);
    return { tournaments, challenges, categories, stats, banners };
  }

  private loadTournaments() {
    return this.prisma.tournament.findMany({
      where: { status: { in: ["LIVE", "UPCOMING"] } },
      orderBy: { dateTime: "asc" },
      take: 8,
    });
  }

  private loadChallenges() {
    return this.prisma.challenge.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 4,
    });
  }

  private async loadCategories() {
    const top = await this.prisma.gameCategory.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
    });
    const activeIds = top.filter((t) => t.isActive).map((t) => t.id);
    const children = activeIds.length
      ? await this.prisma.gameCategory.findMany({
          where: { parentId: { in: activeIds }, isActive: true },
          orderBy: { sortOrder: "asc" },
        })
      : [];
    return top.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      coverUrl: t.coverUrl,
      thumbnailUrl: t.thumbnailUrl,
      isActive: t.isActive,
      comingSoon: t.comingSoon,
      sortOrder: t.sortOrder,
      children: t.isActive
        ? children
            .filter((c) => c.parentId === t.id)
            .map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              gameMode: c.gameMode,
              description: c.description,
              coverUrl: c.coverUrl,
              thumbnailUrl: c.thumbnailUrl,
              sortOrder: c.sortOrder,
            }))
        : [],
    }));
  }

  private async loadStats() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeUsers, downloads] = await Promise.all([
      this.prisma.user.count({
        where: {
          OR: [
            { lastLoginAt: { gte: cutoff } },
            { lastLoginAt: null, createdAt: { gte: cutoff } },
          ],
        },
      }),
      this.prisma.appRelease.aggregate({ _sum: { downloadCount: true } }),
    ]);
    return { activeUsers, totalDownloads: downloads._sum.downloadCount ?? 0 };
  }

  private loadBanners() {
    return this.prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }
}
