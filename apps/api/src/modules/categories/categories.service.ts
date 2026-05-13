import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { MemoryCacheService } from "../../common/cache/memory-cache.service";

const ACTIVE_CATEGORIES_CACHE_KEY = "categories:active";
const ACTIVE_CATEGORIES_TTL_SECONDS = 300;

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private cache: MemoryCacheService,
  ) {}

  async getActiveCategories() {
    return this.cache.getOrSet(
      ACTIVE_CATEGORIES_CACHE_KEY,
      ACTIVE_CATEGORIES_TTL_SECONDS,
      () => this.loadActiveCategories(),
    );
  }

  private async loadActiveCategories() {
    const top = await this.prisma.gameCategory.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
    });

    const activeIds = top.filter((t) => t.isActive).map((t) => t.id);
    const allChildren = activeIds.length
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
      isActive: t.isActive,
      comingSoon: t.comingSoon,
      sortOrder: t.sortOrder,
      children: t.isActive
        ? allChildren
            .filter((c) => c.parentId === t.id)
            .map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              gameMode: c.gameMode,
              description: c.description,
              coverUrl: c.coverUrl,
              sortOrder: c.sortOrder,
            }))
        : [],
    }));
  }
}
