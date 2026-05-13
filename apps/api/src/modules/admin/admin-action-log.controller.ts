import { Controller, ForbiddenException, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AdminActionLogService } from "./admin-action-log.service";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";

@UseGuards(JwtAuthGuard)
@Controller("admin/logs")
export class AdminActionLogController {
  constructor(
    private svc: AdminActionLogService,
    @Inject(PRISMA) private prisma: PrismaClient,
  ) {}

  @Get()
  async list(
    @CurrentUser() u: any,
    @Query("adminId") adminId?: string,
    @Query("resource") resource?: string,
    @Query("resourceId") resourceId?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "50",
  ) {
    const me = await this.prisma.user.findUnique({
      where: { id: u.sub },
      include: { roleRef: true },
    });
    if (me?.roleRef?.name !== "SUPER_ADMIN")
      throw new ForbiddenException("SUPER_ADMIN only");
    return this.svc.getLogs(
      { adminId, resource, resourceId, action, from, to },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
