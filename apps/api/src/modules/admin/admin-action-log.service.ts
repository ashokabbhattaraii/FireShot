import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";

@Injectable()
export class AdminActionLogService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  log(
    adminId: string,
    action: string,
    resource: string,
    resourceId?: string | null,
    oldValue?: any,
    newValue?: any,
    ip?: string | null,
  ) {
    return this.prisma.adminActionLog.create({
      data: {
        adminId,
        action,
        resource,
        resourceId: resourceId ?? null,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
        ip: ip ?? null,
      },
    });
  }

  async getLogs(
    filters: {
      adminId?: string;
      resource?: string;
      resourceId?: string;
      action?: string;
      from?: string;
      to?: string;
    },
    page = 1,
    limit = 50,
  ) {
    const where: any = {};
    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.action) where.action = { contains: filters.action, mode: "insensitive" };
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    const [items, total] = await Promise.all([
      this.prisma.adminActionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { admin: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.adminActionLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
