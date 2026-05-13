import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private cache = new Map<string, boolean>();

  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async onModuleInit() {
    await this.loadAll();
  }

  async loadAll() {
    const flags = await this.prisma.featureFlag.findMany();
    flags.forEach((f) => this.cache.set(f.key, f.enabled));
  }

  isEnabled(key: string): boolean {
    return this.cache.get(key) ?? true;
  }

  async toggle(key: string, enabled: boolean, adminId: string) {
    await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled, updatedBy: adminId },
    });
    this.cache.set(key, enabled);
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        action: enabled ? "ENABLE_FLAG" : "DISABLE_FLAG",
        resource: "feature-flag",
        resourceId: key,
        newValue: { enabled } as any,
      },
    });
  }

  async getAll() {
    return this.prisma.featureFlag.findMany({
      orderBy: [{ group: "asc" }, { label: "asc" }],
    });
  }

  async getPublic(): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany();
    return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
  }
}
