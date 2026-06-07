import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";

@Injectable()
export class SuperAdminService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async listTables() {
    const tables: { tablename: string; row_estimate: number }[] = await this.prisma.$queryRawUnsafe(
      `SELECT relname as tablename, reltuples::int as row_estimate
       FROM pg_class
       WHERE relkind = 'r' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
       ORDER BY relname`,
    );
    return tables.map((t) => ({ name: t.tablename, rowCount: t.row_estimate }));
  }

  async browseTable(table: string, page: number, limit: number) {
    const exists: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
      table,
    );
    if (!exists.length) throw new Error("Table not found");

    const offset = (page - 1) * limit;
    const [countRow]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT reltuples::int as total FROM pg_class WHERE relname = $1`,
      table,
    );
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "${table}" ORDER BY 1 DESC LIMIT ${limit} OFFSET ${offset}`,
    );
    return { table, total: countRow?.total ?? 0, page, limit, rows };
  }

  async listAllUsers(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const [total, users] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profile: true,
          wallet: { select: { balanceNpr: true } },
          _count: { select: { payments: true, tournaments: true, withdrawals: true } },
        },
      }),
    ]);
    return { total, page, limit, users };
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
      if (tablename.startsWith("_")) continue;
      const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM "${tablename}" ORDER BY 1`);
      result.tables[tablename] = { rowCount: (rows as any[]).length, data: rows };
    }
    return result;
  }

  async restoreBackup(backup: { tables: Record<string, { data: any[] }> }) {
    if (!backup?.tables) throw new Error("Invalid backup format");

    // Get valid table names
    const existing: { tablename: string }[] = await this.prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const validTables = new Set(existing.map((t) => t.tablename));

    const restored: { table: string; rows: number }[] = [];

    // Disable FK constraints during restore
    await this.prisma.$executeRawUnsafe(`SET session_replication_role = 'replica'`);

    try {
      for (const [table, content] of Object.entries(backup.tables)) {
        if (!validTables.has(table) || !content.data?.length) continue;

        // Clear existing data
        await this.prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);

        // Insert rows in batches
        const cols = Object.keys(content.data[0]);
        const colList = cols.map((c) => `"${c}"`).join(", ");

        for (let i = 0; i < content.data.length; i += 50) {
          const batch = content.data.slice(i, i + 50);
          const values = batch.map((row) => {
            const vals = cols.map((c) => {
              const v = row[c];
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
              if (typeof v === "number") return String(v);
              if (Array.isArray(v)) {
                if (v.length === 0) return "'{}'";
                const items = v.map((i) => `"${String(i).replace(/"/g, '\\"')}"`).join(",");
                return `'{${items}}'`;
              }
              if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
              return `'${String(v).replace(/'/g, "''")}'`;
            });
            return `(${vals.join(", ")})`;
          }).join(",\n");

          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "${table}" (${colList}) VALUES ${values} ON CONFLICT DO NOTHING`,
          );
        }
        restored.push({ table, rows: content.data.length });
      }
    } finally {
      await this.prisma.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
    }

    return { restoredAt: new Date().toISOString(), tables: restored };
  }
}
