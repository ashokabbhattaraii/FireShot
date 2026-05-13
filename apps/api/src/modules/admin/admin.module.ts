import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  AdminUpdateUserDto,
  AdminUsersService,
  BalanceAdjustmentDto,
} from "./admin-users.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin")
export class AdminController {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private adminUsers: AdminUsersService,
  ) {}

  @RequirePermission("reports", "read")
  @Get("stats")
  async stats() {
    const [
      users,
      admins,
      bannedUsers,
      tournaments,
      liveTournaments,
      upcomingTournaments,
      completed,
      pendingPayments,
      pendingWithdrawals,
      pendingResults,
      approvedPayments,
      walletBalance,
      recentPayments,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "ADMIN" } }),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.tournament.count(),
      this.prisma.tournament.count({ where: { status: "LIVE" } }),
      this.prisma.tournament.count({ where: { status: "UPCOMING" } }),
      this.prisma.tournament.count({ where: { status: "COMPLETED" } }),
      this.prisma.payment.count({ where: { status: "PENDING" } }),
      this.prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
      this.prisma.matchResult.count({ where: { verified: false } }),
      this.prisma.payment.aggregate({
        where: { status: "APPROVED" },
        _sum: { amountNpr: true },
      }),
      this.prisma.wallet.aggregate({ _sum: { balanceNpr: true } }),
      this.prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              role: true,
              profile: true,
            },
          },
          tournament: true,
        },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isBanned: true,
          createdAt: true,
          profile: true,
        },
      }),
    ]);
    return {
      users,
      admins,
      bannedUsers,
      tournaments,
      liveTournaments,
      upcomingTournaments,
      completed,
      pendingPayments,
      pendingWithdrawals,
      pendingResults,
      approvedRevenueNpr: approvedPayments._sum.amountNpr ?? 0,
      walletLiabilityNpr: walletBalance._sum.balanceNpr ?? 0,
      recentPayments,
      recentUsers,
    };
  }

  @RequirePermission("users", "read")
  @Get("users")
  users() {
    return this.adminUsers.listUsers();
  }

  @RequirePermission("users", "read")
  @Get("users/:id")
  userDetail(@CurrentUser() u: any, @Param("id") id: string) {
    return this.adminUsers.getProfile(u.sub, id);
  }

  @RequirePermission("users", "write")
  @Put("users/:id")
  updateUser(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: AdminUpdateUserDto,
    @Req() req: any,
  ) {
    return this.adminUsers.updateProfile(u.sub, id, body, req.ip);
  }

  @RequirePermission("users", "ban")
  @Post("users/:id/ban")
  async ban(@CurrentUser() u: any, @Param("id") id: string, @Req() req: any) {
    return this.adminUsers.setSuspended(u.sub, id, true, req.ip);
  }

  @RequirePermission("users", "ban")
  @Post("users/:id/unban")
  async unban(@CurrentUser() u: any, @Param("id") id: string, @Req() req: any) {
    return this.adminUsers.setSuspended(u.sub, id, false, req.ip);
  }

  @RequirePermission("users", "lock")
  @Post("users/:id/lock")
  lock(@CurrentUser() u: any, @Param("id") id: string, @Req() req: any) {
    return this.adminUsers.setLocked(u.sub, id, true, req.ip);
  }

  @RequirePermission("users", "lock")
  @Post("users/:id/unlock")
  unlock(@CurrentUser() u: any, @Param("id") id: string, @Req() req: any) {
    return this.adminUsers.setLocked(u.sub, id, false, req.ip);
  }

  @RequirePermission("users", "session")
  @Post("users/:id/reset-sessions")
  resetSessions(@CurrentUser() u: any, @Param("id") id: string, @Req() req: any) {
    return this.adminUsers.resetSessions(u.sub, id, req.ip);
  }

  @RequirePermission("payments", "adjust")
  @Post("users/:id/balance-adjustments")
  adjustBalance(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: BalanceAdjustmentDto,
    @Req() req: any,
  ) {
    return this.adminUsers.adjustBalance(u.sub, id, body, req.ip);
  }
}

import { SystemConfigService } from "./system-config.service";
import { SystemConfigController } from "./system-config.controller";
import { FreeDailyWindowService } from "./free-daily-window.service";
import { FreeDailyWindowAdminController } from "./free-daily-window.controller";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";
import { AdminActionLogService } from "./admin-action-log.service";
import { AdminActionLogController } from "./admin-action-log.controller";
import { ApkTestService } from "./apk-test.service";
import { ApkTestController } from "./apk-test.controller";
import { AppConfigService } from "./app-config.service";
import { AppConfigController } from "./app-config.controller";
import { FeatureFlagService } from "./feature-flag.service";
import {
  FeatureFlagAdminController,
  FeatureFlagPublicController,
} from "./feature-flag.controller";
import { AdminNavController } from "./admin-nav.controller";
import { FinancialRiskService } from "../finance/financial-risk.service";
import { ReportService } from "../finance/report.service";
import { FinanceController } from "../finance/finance.controller";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";
import { StorageModule } from "../../common/storage/storage.module";
import { ProfileModule } from "../profile/profile.module";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

@Module({
  imports: [StorageModule, ProfileModule, MulterModule.register({ storage: memoryStorage() })],
  controllers: [
    AdminController,
    SystemConfigController,
    FreeDailyWindowAdminController,
    RolesController,
    AdminActionLogController,
    ApkTestController,
    AppConfigController,
    FeatureFlagAdminController,
    FeatureFlagPublicController,
    AdminNavController,
    FinanceController,
  ],
  providers: [
    SystemConfigService,
    FreeDailyWindowService,
    RolesService,
    AdminActionLogService,
    ApkTestService,
    AppConfigService,
    FeatureFlagService,
    PermissionsGuard,
    FeatureFlagGuard,
    AdminUsersService,
    FinancialRiskService,
    ReportService,
  ],
  exports: [
    SystemConfigService,
    FreeDailyWindowService,
    RolesService,
    AdminActionLogService,
    AppConfigService,
    FeatureFlagService,
    FeatureFlagGuard,
    PermissionsGuard,
    FinancialRiskService,
    ReportService,
  ],
})
export class AdminModule {}
