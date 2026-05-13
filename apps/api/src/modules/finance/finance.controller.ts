import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PrismaClient, PaymentStatus, Role, WithdrawalStatus } from "@fireslot/db";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { Roles, RolesGuard } from "../../common/guards/roles.guard";
import { PRISMA } from "../../prisma/prisma.module";
import { Inject } from "@nestjs/common";
import { FinancialRiskService } from "./financial-risk.service";
import { ReportService } from "./report.service";

@UseGuards(JwtAuthGuard)
@Controller("admin")
export class FinanceController {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private risk: FinancialRiskService,
    private reports: ReportService,
  ) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("withdrawals", "read")
  @Get("withdrawals")
  listWithdrawals(@Query("status") status?: WithdrawalStatus) {
    return this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true, financialRiskProfile: true, profile: true } },
        withdrawalReview: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("withdrawals", "read")
  @Get("withdrawals/:id/risk")
  async withdrawalRisk(@Param("id") id: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true, profile: true, financialRiskProfile: true } } },
    });
    if (!withdrawal) throw new NotFoundException("Withdrawal not found");
    const details = await this.risk.getRiskDetails(withdrawal.userId);
    return { withdrawal, ...details, check: await this.risk.checkWithdrawalRisk(withdrawal.userId, withdrawal.amountNpr) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("withdrawals", "approve")
  @Post("withdrawals/:id/approve")
  async approveWithdrawal(@Param("id") id: string, @Body() body: { reviewNote?: string }, @CurrentUser() user: any, @Req() req: any) {
    const reviewNote = this.requireComment(body.reviewNote, "reviewNote");
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({ where: { id }, include: { user: true } });
    if (!withdrawal) throw new NotFoundException("Withdrawal not found");
    if (withdrawal.status !== "PENDING") throw new BadRequestException("Already processed");
    const check = await this.risk.checkWithdrawalRisk(withdrawal.userId, withdrawal.amountNpr);
    const force = (body as any)?.force === true;
    if (check.blockedReason && !force) throw new ForbiddenException(`Cannot approve: ${check.blockedReason}`);
    if (check.blockedReason && force) {
      const actor = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { role: true } });
      if (!actor || (actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN)) {
        throw new ForbiddenException("Only ADMIN or SUPER_ADMIN can force-approve critical withdrawals");
      }
    }
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: withdrawal.userId } });

    const updated = await this.prisma.$transaction(async (tx) => {
      const review = await tx.withdrawalReview.create({
        data: {
          withdrawalId: id,
          reviewedBy: user.sub,
          riskSnapshot: check.profile as any,
          reviewNote,
          decision: "APPROVED",
          ipAddress: req.ip,
        },
      });
      const next = await tx.withdrawalRequest.update({
        where: { id },
        data: { status: WithdrawalStatus.APPROVED, reviewedAt: new Date(), note: reviewNote },
      });
      await tx.adminActionLog.create({
        data: { adminId: user.sub, action: check.blockedReason && force ? "FORCE_APPROVE_WITHDRAWAL" : "APPROVE_WITHDRAWAL", resource: "withdrawal", resourceId: id, newValue: { status: "APPROVED", amountNpr: withdrawal.amountNpr, reviewId: review.id, override: force ? true : false, comment: reviewNote }, oldValue: check.blockedReason ? { blockedReason: check.blockedReason } : undefined },
      });
      await tx.notification.create({
        data: { userId: withdrawal.userId, type: "WALLET", title: "Withdrawal approved", body: `Your withdrawal of NPR ${withdrawal.amountNpr} has been approved. Current balance: NPR ${wallet?.balanceNpr ?? 0}. Reason: ${reviewNote}` },
      });
      return next;
    });

    return updated;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("withdrawals", "approve")
  @Post("withdrawals/:id/reject")
  async rejectWithdrawal(@Param("id") id: string, @Body() body: { reason?: string }, @CurrentUser() user: any, @Req() req: any) {
    const reason = this.requireComment(body.reason, "reason");
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({ where: { id }, include: { user: true } });
    if (!withdrawal) throw new NotFoundException("Withdrawal not found");
    if (withdrawal.status !== "PENDING") throw new BadRequestException("Already processed");
    const profile = await this.risk.buildRiskProfile(withdrawal.userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.withdrawalReview.create({
        data: { withdrawalId: id, reviewedBy: user.sub, riskSnapshot: profile as any, reviewNote: reason, decision: "REJECTED", ipAddress: req.ip },
      });
      await tx.withdrawalRequest.update({ where: { id }, data: { status: WithdrawalStatus.REJECTED, reviewedAt: new Date(), note: reason } });
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
      let newBalance: number | null = null;
      if (wallet) {
        const updatedWallet = await tx.wallet.update({ where: { userId: withdrawal.userId }, data: { balanceNpr: { increment: withdrawal.amountNpr } } });
        newBalance = updatedWallet.balanceNpr;
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: "CREDIT", reason: "REFUND", amountNpr: withdrawal.amountNpr, note: `Withdrawal rejected: ${reason}` },
        });
      }
      await tx.adminActionLog.create({
        data: { adminId: user.sub, action: "REJECT_WITHDRAWAL", resource: "withdrawal", resourceId: id, newValue: { status: "REJECTED", reason } },
      });
      await tx.notification.create({
        data: { userId: withdrawal.userId, type: "WALLET", title: "Withdrawal rejected", body: `Your withdrawal of NPR ${withdrawal.amountNpr} was rejected and refunded. ${newBalance == null ? "" : `New balance: NPR ${newBalance}. `}Reason: ${reason}` },
      });
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("withdrawals", "approve")
  @Post("withdrawals/:id/reverse")
  async reverseWithdrawal(@Param("id") id: string, @Body() body: { reason?: string }, @CurrentUser() user: any, @Req() req: any) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: true, withdrawalReview: true },
    });
    if (!withdrawal) throw new NotFoundException("Withdrawal not found");
    if (!withdrawal.withdrawalReview || withdrawal.withdrawalReview.decision !== "APPROVED") {
      throw new BadRequestException("Only approved withdrawals can be reversed");
    }
    if (Date.now() - withdrawal.withdrawalReview.decisionAt.getTime() > 60 * 60 * 1000) {
      throw new BadRequestException("Reversal window expired");
    }

    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
      if (wallet) {
        await tx.wallet.update({ where: { userId: withdrawal.userId }, data: { balanceNpr: { increment: withdrawal.amountNpr } } });
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: "CREDIT", reason: "REFUND", amountNpr: withdrawal.amountNpr, note: `Withdrawal reversed: ${body.reason ?? "ADMIN reversal"}` },
        });
      }
      await tx.withdrawalRequest.update({ where: { id }, data: { status: WithdrawalStatus.PENDING, note: body.reason ?? withdrawal.note } });
      await tx.adminActionLog.create({
        data: { adminId: user.sub, action: "REVERSE_WITHDRAWAL", resource: "withdrawal", resourceId: id, newValue: { status: "PENDING", reason: body.reason ?? null }, oldValue: { status: withdrawal.status } },
      });
    });

    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("payments", "read")
  @Get("payments")
  listPayments(@Query("status") status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true, financialRiskProfile: true, profile: true } },
        tournament: true,
        depositReview: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("payments", "read")
  @Get("payments/:id/risk")
  async paymentRisk(@Param("id") id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true, profile: true, financialRiskProfile: true } }, tournament: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const details = await this.risk.getRiskDetails(payment.userId);
    return { payment, ...details, check: await this.risk.checkDepositRisk(payment.userId) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("payments", "approve")
  @Post("payments/:id/approve")
  async approvePayment(@Param("id") id: string, @Body() body: { reviewNote?: string }, @CurrentUser() user: any, @Req() req: any) {
    const reviewNote = this.requireComment(body.reviewNote, "reviewNote");
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { user: true, tournament: true } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "PENDING") throw new BadRequestException("Already processed");
    const check = await this.risk.checkDepositRisk(payment.userId);
    const force = (body as any)?.force === true;
    if (check.blockedReason && !force) throw new ForbiddenException(check.blockedReason);
    if (check.blockedReason && force) {
      const actor = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { role: true } });
      if (!actor || (actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN)) {
        throw new ForbiddenException("Only ADMIN or SUPER_ADMIN can force-approve critical payments");
      }
    }
    await this.prisma.$transaction(async (tx) => {
      let resultingBalance: number | null = null;
      await tx.depositReview.create({
        data: { paymentId: id, reviewedBy: user.sub, riskSnapshot: check.profile as any, reviewNote, decision: "APPROVED", ipAddress: req.ip },
      });
      await tx.payment.update({ where: { id }, data: { status: PaymentStatus.APPROVED, reviewedById: user.sub, reviewedAt: new Date() } });
      if (payment.tournamentId) {
        await tx.tournamentParticipant.update({
          where: { tournamentId_userId: { tournamentId: payment.tournamentId, userId: payment.userId } },
          data: { paid: true },
        });
        await tx.tournament.update({ where: { id: payment.tournamentId }, data: { filledSlots: { increment: 1 } } });
      } else {
        const wallet = await tx.wallet.upsert({
          where: { userId: payment.userId },
          update: { balanceNpr: { increment: payment.amountNpr } },
          create: { userId: payment.userId, balanceNpr: payment.amountNpr },
        });
        resultingBalance = wallet.balanceNpr;
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: "CREDIT", reason: "ADJUSTMENT", amountNpr: payment.amountNpr, note: reviewNote },
        });
        await this.rewardReferrerForFirstDeposit(tx, payment.userId, id);
      }
      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: "PAYMENT",
          title: payment.tournamentId ? "Payment approved" : "Deposit approved",
          body: payment.tournamentId
            ? `Your payment of NPR ${payment.amountNpr} has been approved. Room details are now visible. Reason: ${reviewNote}`
            : `Your wallet deposit of NPR ${payment.amountNpr} has been approved. New balance: NPR ${resultingBalance ?? payment.amountNpr}. Reason: ${reviewNote}`,
        },
      });
      await tx.adminActionLog.create({
        data: { adminId: user.sub, action: check.blockedReason && force ? "FORCE_APPROVE_PAYMENT" : "APPROVE_PAYMENT", resource: "payment", resourceId: id, newValue: { status: "APPROVED", amountNpr: payment.amountNpr, override: force ? true : false, comment: reviewNote, resultingBalance }, oldValue: check.blockedReason ? { blockedReason: check.blockedReason } : undefined },
      });
    });
    return { ok: true };
  }

  private async rewardReferrerForFirstDeposit(tx: any, referredId: string, paymentId: string) {
    const enabledConfig = await tx.systemConfig.findUnique({ where: { key: "REFERRAL_ENABLED" } });
    const enabled = enabledConfig ? String(enabledConfig.value).toLowerCase() === "true" : true;
    if (!enabled) return;

    const referral = await tx.referral.findUnique({ where: { referredId } });
    if (!referral || referral.depositRewardedAt) return;

    const firstApprovedWalletDeposit = await tx.payment.findFirst({
      where: {
        userId: referredId,
        tournamentId: null,
        status: "APPROVED",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!firstApprovedWalletDeposit) return;

    const amountConfig = await tx.systemConfig.findUnique({
      where: { key: "REFERRAL_FIRST_DEPOSIT_REWARD_NPR" },
    });
    const amount = Number(amountConfig?.value ?? 10);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const referrerWallet = await tx.wallet.upsert({
      where: { userId: referral.referrerId },
      create: { userId: referral.referrerId, balanceNpr: amount },
      update: { balanceNpr: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: referrerWallet.id,
        type: "CREDIT",
        reason: "ADJUSTMENT",
        amountNpr: amount,
        note: "Referral first deposit reward",
      },
    });

    await tx.referral.update({
      where: { id: referral.id },
      data: {
        referrerDepositRewardNpr: amount,
        depositRewardedAt: new Date(),
        firstDepositPaymentId: firstApprovedWalletDeposit.id || paymentId,
      },
    });

    await tx.notification.create({
      data: {
        userId: referral.referrerId,
        type: "WALLET",
        title: "Referral reward unlocked",
        body: `Rs ${amount} added because your referred player made their first deposit.`,
      },
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("payments", "approve")
  @Post("payments/:id/reject")
  async rejectPayment(@Param("id") id: string, @Body() body: { reason?: string }, @CurrentUser() user: any, @Req() req: any) {
    const reason = this.requireComment(body.reason, "reason");
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { user: true } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "PENDING") throw new BadRequestException("Already processed");
    const profile = await this.risk.buildRiskProfile(payment.userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.depositReview.create({
        data: { paymentId: id, reviewedBy: user.sub, riskSnapshot: profile as any, reviewNote: reason, decision: "REJECTED", ipAddress: req.ip },
      });
      await tx.payment.update({ where: { id }, data: { status: PaymentStatus.REJECTED, reviewedById: user.sub, reviewedAt: new Date() } });
      await tx.adminActionLog.create({
        data: { adminId: user.sub, action: "REJECT_PAYMENT", resource: "payment", resourceId: id, newValue: { status: "REJECTED", reason } },
      });
      await tx.notification.create({
        data: { userId: payment.userId, type: "PAYMENT", title: "Payment rejected", body: `Your payment of NPR ${payment.amountNpr} was rejected. Reason: ${reason}` },
      });
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("reports", "read")
  @Get("reports")
  reportsList(@CurrentUser() user: any) {
    return this.reports.listReports(user.sub);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("reports", "read")
  @Post("reports/generate")
  generateReport(@CurrentUser() user: any, @Body() body: { type: string; from: string; to: string }) {
    if (!body?.from || !body?.to) throw new BadRequestException("from and to are required");
    return this.reports.generateReport(user.sub, body.type, new Date(body.from), new Date(body.to));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("reports", "read")
  @Get("reports/:id")
  getReport(@Param("id") id: string, @CurrentUser() user: any) {
    return this.reports.getReportById(user.sub, id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("finance", "read")
  @Get("finance/risk-profiles")
  riskProfiles(@Query("riskLevel") riskLevel?: string, @Query("search") search?: string, @Query("blacklisted") blacklisted?: string) {
    return this.risk.listProfiles({
      riskLevel: riskLevel || undefined,
      search: search || undefined,
      blacklisted: blacklisted === undefined ? undefined : blacklisted === "true",
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("finance", "read")
  @Get("finance/risk-profiles/:userId")
  riskProfile(@Param("userId") userId: string) {
    return this.risk.getRiskDetails(userId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("finance", "write")
  @Post("finance/blacklist/:userId")
  blacklist(@Param("userId") userId: string, @Body() body: { reason?: string }, @CurrentUser() user: any) {
    if (!body?.reason) throw new BadRequestException("reason is required");
    return this.risk.blacklistUser(userId, body.reason, user.sub);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("finance", "write")
  @Delete("finance/blacklist/:userId")
  removeBlacklist(@Param("userId") userId: string, @CurrentUser() user: any) {
    return this.risk.removeBlacklist(userId, user.sub);
  }

  private requireComment(value: string | undefined, field: string) {
    const comment = value?.trim();
    if (!comment) throw new BadRequestException(`${field} is required`);
    if (comment.length < 10) {
      throw new BadRequestException(`${field} must be at least 10 characters`);
    }
    return comment;
  }
}
