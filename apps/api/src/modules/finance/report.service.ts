import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { RolesService } from "../admin/roles.service";

@Injectable()
export class ReportService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private roles: RolesService,
  ) {}

  private async assertAccess(adminId: string) {
    const ok = await this.roles.hasPermission(adminId, "reports", "read");
    if (!ok) throw new ForbiddenException("Reports are restricted to ADMIN and SUPER_ADMIN only");
  }

  async generateReport(adminId: string, type: string, from: Date, to: Date) {
    await this.assertAccess(adminId);

    const [deposits, withdrawals, prizes, entryFees, users, tournaments, criticalUsers, highRiskUsers] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: { status: "APPROVED", createdAt: { gte: from, lte: to } },
          _sum: { amountNpr: true },
          _count: true,
        }),
        this.prisma.withdrawalRequest.aggregate({
          where: { status: { in: ["APPROVED", "PAID"] }, createdAt: { gte: from, lte: to } },
          _sum: { amountNpr: true },
          _count: true,
        }),
        this.prisma.walletTransaction.aggregate({
          where: { reason: "PRIZE", createdAt: { gte: from, lte: to } },
          _sum: { amountNpr: true },
          _count: true,
        }),
        this.prisma.walletTransaction.aggregate({
          where: { reason: "ENTRY_FEE", createdAt: { gte: from, lte: to } },
          _sum: { amountNpr: true },
          _count: true,
        }),
        this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
        this.prisma.tournament.count({ where: { createdAt: { gte: from, lte: to } } }),
        this.prisma.financialRiskProfile.count({ where: { riskLevel: "CRITICAL" } }),
        this.prisma.financialRiskProfile.count({ where: { riskLevel: "HIGH" } }),
      ]);

    const reportData = {
      period: { from, to, type },
      summary: {
        totalDeposits: { amount: deposits._sum.amountNpr ?? 0, count: deposits._count },
        totalWithdrawals: { amount: withdrawals._sum.amountNpr ?? 0, count: withdrawals._count },
        totalPrizesPaid: { amount: prizes._sum.amountNpr ?? 0, count: prizes._count },
        totalEntryFees: { amount: entryFees._sum.amountNpr ?? 0, count: entryFees._count },
        platformRevenue: (entryFees._sum.amountNpr ?? 0) - (prizes._sum.amountNpr ?? 0),
        newUsers: users,
        tournamentsRun: tournaments,
      },
      risk: { criticalUsers, highRiskUsers },
      topEarners: await this.topUsersByReason("PRIZE", from, to),
      topDepositors: await this.topDepositors(from, to),
      dailyBreakdown: await this.dailyBreakdown(from, to),
      generatedAt: new Date(),
      generatedBy: adminId,
    };

    await this.prisma.financialReport.create({
      data: { generatedBy: adminId, reportType: type, fromDate: from, toDate: to, data: reportData as any },
    });

    return reportData;
  }

  async listReports(adminId: string) {
    await this.assertAccess(adminId);
    return this.prisma.financialReport.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getReportById(adminId: string, id: string) {
    await this.assertAccess(adminId);
    const report = await this.prisma.financialReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");
    return report;
  }

  private async topUsersByReason(reason: "PRIZE" | "ENTRY_FEE", from: Date, to: Date) {
    const txs = await this.prisma.walletTransaction.findMany({
      where: { reason, createdAt: { gte: from, lte: to } },
      include: { wallet: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });
    const grouped = new Map<string, { userId: string; email: string; name: string | null; amount: number; count: number }>();
    for (const tx of txs) {
      const user = tx.wallet.user;
      const current = grouped.get(user.id) ?? { userId: user.id, email: user.email, name: user.name, amount: 0, count: 0 };
      current.amount += tx.amountNpr;
      current.count += 1;
      grouped.set(user.id, current);
    }
    return [...grouped.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }

  private async topDepositors(from: Date, to: Date) {
    const payments = await this.prisma.payment.findMany({
      where: { status: "APPROVED", createdAt: { gte: from, lte: to } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    const grouped = new Map<string, { userId: string; email: string; name: string | null; amount: number; lastDepositAt: Date | null }>();
    for (const payment of payments) {
      const user = payment.user;
      const current = grouped.get(user.id) ?? { userId: user.id, email: user.email, name: user.name, amount: 0, lastDepositAt: null };
      current.amount += payment.amountNpr;
      current.lastDepositAt = !current.lastDepositAt || payment.createdAt > current.lastDepositAt ? payment.createdAt : current.lastDepositAt;
      grouped.set(user.id, current);
    }
    return [...grouped.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }

  private async dailyBreakdown(from: Date, to: Date) {
    const [payments, withdrawals, prizes] = await Promise.all([
      this.prisma.payment.findMany({ where: { status: "APPROVED", createdAt: { gte: from, lte: to } }, select: { amountNpr: true, createdAt: true } }),
      this.prisma.withdrawalRequest.findMany({ where: { status: { in: ["APPROVED", "PAID"] }, createdAt: { gte: from, lte: to } }, select: { amountNpr: true, createdAt: true } }),
      this.prisma.walletTransaction.findMany({ where: { reason: "PRIZE", createdAt: { gte: from, lte: to } }, select: { amountNpr: true, createdAt: true } }),
    ]);

    const byDay = new Map<string, { date: string; deposits: number; withdrawals: number; prizes: number; txCount: number }>();
    const collect = (date: Date) => date.toISOString().slice(0, 10);
    const bucket = (date: string) => byDay.get(date) ?? { date, deposits: 0, withdrawals: 0, prizes: 0, txCount: 0 };

    for (const payment of payments) {
      const key = collect(payment.createdAt);
      const row = bucket(key);
      row.deposits += payment.amountNpr;
      row.txCount += 1;
      byDay.set(key, row);
    }
    for (const withdrawal of withdrawals) {
      const key = collect(withdrawal.createdAt);
      const row = bucket(key);
      row.withdrawals += withdrawal.amountNpr;
      row.txCount += 1;
      byDay.set(key, row);
    }
    for (const prize of prizes) {
      const key = collect(prize.createdAt);
      const row = bucket(key);
      row.prizes += prize.amountNpr;
      row.txCount += 1;
      byDay.set(key, row);
    }

    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}