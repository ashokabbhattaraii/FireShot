import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "./admin-action-log.service";

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(@Inject(PRISMA) private prisma: PrismaClient, private logs: AdminActionLogService) {}

  async getAll() {
    try {
      return await (this.prisma as any).appConfig.findMany({ orderBy: { key: 'asc' } });
    } catch (e) {
      this.logger.warn('AppConfig table missing or DB unavailable');
      return [];
    }
  }

  async getPublic() {
    const rows = await this.getAll();
    const obj: Record<string, string> = {};
    for (const r of rows) obj[r.key] = r.value;
    return obj;
  }

  async get(key: string) {
    return (await (this.prisma as any).appConfig.findUnique({ where: { key } }))?.value ?? null;
  }

  async set(key: string, value: string, adminId: string, ip?: string | null) {
    const existing = await (this.prisma as any).appConfig.findUnique({ where: { key } });
    const updated = existing
      ? await (this.prisma as any).appConfig.update({ where: { key }, data: { value, updatedBy: adminId } })
      : await (this.prisma as any).appConfig.create({ data: { key, value, updatedBy: adminId } });
    await this.logs.log(adminId, 'appconfig.update', 'appconfig', key, existing ?? null, updated, ip);
    return updated;
  }
}
