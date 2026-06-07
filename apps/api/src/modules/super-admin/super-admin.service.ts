import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";

@Injectable()
export class SuperAdminService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async listTables() {
    const tables: { tablename: string }[] = await this.prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const counts: Record<string, number> = {};
    for (const { tablename } of tables) {
      const [row]: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "${tablename}"`,
      );
      counts[tablename] = row?.count ?? 0;
    }
    return tables.map((t) => ({ name: t.tablename, rowCount: counts[t.tablename] }));
  }

  async browseTable(table: string, page: number, limit: number) {
    // Validate table exists to prevent injection
    const exists: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
      table,
    );
    if (!exists.length) throw new Error("Table not found");

    const offset = (page - 1) * limit;
    const [countRow]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "${table}"`,
    );
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "${table}" ORDER BY 1 DESC LIMIT ${limit} OFFSET ${offset}`,
    );
    return { table, total: countRow?.total ?? 0, page, limit, rows };
  }

  async getUserFull(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: true,
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
        tournaments: { orderBy: { joinedAt: "desc" }, take: 20, include: { tournament: { select: { id: true, title: true, status: true } } } },
        withdrawals: { orderBy: { createdAt: "desc" }, take: 20 },
        notifications: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!user) throw new Error("User not found");
    return user;
  }

  async exportTable(table: string) {
    const exists: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
      table,
    );
    if (!exists.length) throw new Error("Table not found");
    const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY 1`);
    return { table, exportedAt: new Date().toISOString(), rowCount: (rows as any[]).length, data: rows };
  }

  async exportAllTables() {
    const tables: { tablename: string }[] = await this.prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const result: Record<string, any> = { exportedAt: new Date().toISOString(), tables: {} };
    for (const { tablename } of tables) {
      if (tablename.startsWith("_")) continue; // skip prisma migration tables
      const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM "${tablename}" ORDER BY 1`);
      result.tables[tablename] = { rowCount: (rows as any[]).length, data: rows };
    }
    return result;
  }
}
