import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { ProfileService } from "../profile/profile.service";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

@Injectable()
export class FinancialRiskService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient, private profiles: ProfileService) {}

  async buildRiskProfile(userId: string) {
    const [user, existingProfile, transactions, participants, disputes, payments, withdrawals] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            createdAt: true,
            isBanned: true,
            lastLoginAt: true,
            profile: { select: { freeFireUid: true, isBlacklisted: true, blacklistReason: true } },
          },
        }),
        this.prisma.financialRiskProfile.findUnique({ where: { userId } }),
        this.prisma.walletTransaction.findMany({
          where: { wallet: { userId } },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.tournamentParticipant.findMany({
          where: { userId },
          include: { tournament: { select: { id: true, title: true, status: true, createdAt: true } } },
          orderBy: { joinedAt: "desc" },
        }),
        this.prisma.challengeDispute.findMany({
          where: { raisedBy: userId },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.payment.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.withdrawalRequest.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    if (!user) throw new NotFoundException("User not found");

    const totalDeposited = payments
      .filter((payment) => payment.status === "APPROVED")
      .reduce((sum, payment) => sum + payment.amountNpr, 0);
    const totalWithdrawn = transactions
      .filter((tx) => tx.reason === "WITHDRAWAL")
      .reduce((sum, tx) => sum + tx.amountNpr, 0);
    const totalPrizeEarned = transactions
      .filter((tx) => tx.reason === "PRIZE")
      .reduce((sum, tx) => sum + tx.amountNpr, 0);
    const totalEntryFeesPaid = transactions
      .filter((tx) => tx.reason === "ENTRY_FEE")
      .reduce((sum, tx) => sum + tx.amountNpr, 0);
    const winCount = participants.filter((entry) => (entry.prizeEarned ?? 0) > 0 || (entry.placement ?? 0) === 1).length;
    const rejectedPayments = payments.filter((payment) => payment.status === "REJECTED").length;
    const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000);
    const approvedDeposits = payments.filter((payment) => payment.status === "APPROVED");
    const recentCutoff = Date.now() - 86_400_000;
    const recentApprovedDeposits = approvedDeposits.filter((payment) => new Date(payment.createdAt).getTime() > recentCutoff);
    const recentWithdrawals = withdrawals.filter((withdrawal) => new Date(withdrawal.createdAt).getTime() > recentCutoff);
    const openDisputes = disputes.filter((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW");
    const pendingDisputes = disputes.filter((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW").length;
    const flags: string[] = [];

    if (accountAgeDays < 3) flags.push("NEW_ACCOUNT: Account less than 3 days old");
    if (totalWithdrawn > totalDeposited + totalPrizeEarned + 10) {
      flags.push("WITHDRAWAL_EXCEEDS_INCOME: Withdrawing more than deposited + earned");
    }
    if (totalDeposited > 0 && totalWithdrawn / Math.max(totalDeposited, 1) > 0.9 && participants.length < 3) {
      flags.push("LOW_ACTIVITY_HIGH_WITHDRAWAL: Withdrew 90%+ of deposits with less than 3 tournaments played");
    }
    if (recentWithdrawals.length >= 2) {
      flags.push(`RAPID_WITHDRAWALS: ${recentWithdrawals.length} withdrawals in last 24 hours`);
    }
    if (rejectedPayments >= 2) {
      flags.push(`MULTIPLE_REJECTED_PAYMENTS: ${rejectedPayments} payments previously rejected`);
    }
    if (openDisputes.length >= 1) {
      flags.push(`OPEN_DISPUTE: ${openDisputes.length} open dispute(s)`);
    }
    if (disputes.length >= 2) {
      flags.push(`MULTIPLE_DISPUTES: ${disputes.length} disputes raised`);
    }
    if (user.isBanned) flags.push("ACCOUNT_BANNED: User is currently banned");
    if (!user.profile?.freeFireUid) flags.push("NO_PROFILE: No Free Fire profile linked");
    if (totalWithdrawn === 0 && totalDeposited > 0 && participants.length === 0) {
      flags.push("DEPOSIT_NO_PLAY: Deposited but never joined a tournament");
    }
    if (recentApprovedDeposits.length >= 3) {
      flags.push(`RAPID_DEPOSITS: ${recentApprovedDeposits.length} deposits in last 24 hours`);
    }
    const winRate = participants.length > 0 ? winCount / participants.length : 0;
    if (winRate > 0.8 && participants.length >= 5) {
      flags.push(`HIGH_WIN_RATE: ${Math.round(winRate * 100)}% win rate across ${participants.length} tournaments`);
    }

    let riskScore = 0;
    if (accountAgeDays < 3) riskScore += 30;
    if (flags.some((flag) => flag.startsWith("WITHDRAWAL_EXCEEDS"))) riskScore += 40;
    if (flags.some((flag) => flag.startsWith("LOW_ACTIVITY"))) riskScore += 25;
    if (recentWithdrawals.length >= 2) riskScore += 15;
    if (rejectedPayments >= 2) riskScore += 20;
    if (disputes.length >= 2) riskScore += 15;
    if (user.isBanned) riskScore += 50;
    if (flags.some((flag) => flag.startsWith("RAPID_DEPOSITS"))) riskScore += 20;
    if (flags.some((flag) => flag.startsWith("HIGH_WIN_RATE"))) riskScore += 20;
    riskScore = Math.min(riskScore, 100);

    const riskLevel: RiskLevel =
      riskScore >= 70 ? "CRITICAL" : riskScore >= 40 ? "HIGH" : riskScore >= 20 ? "MEDIUM" : "LOW";
    const isBlacklisted = Boolean(existingProfile?.isBlacklisted || user.profile?.isBlacklisted);
    const blacklistReason = existingProfile?.blacklistReason ?? user.profile?.blacklistReason ?? null;

    return this.prisma.financialRiskProfile.upsert({
      where: { userId },
      create: {
        userId,
        riskScore,
        riskLevel,
        flags,
        totalDeposited,
        totalWithdrawn,
        totalPrizeEarned,
        totalEntryFeesPaid,
        tournamentCount: participants.length,
        winCount,
        disputeCount: disputes.length,
        rejectedPaymentCount: rejectedPayments,
        lastDepositAt: approvedDeposits[0]?.createdAt ?? null,
        lastWithdrawAt: withdrawals[0]?.createdAt ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        accountAgeDays,
        isBlacklisted,
        blacklistReason,
        reviewedBy: existingProfile?.reviewedBy ?? null,
        reviewNote: existingProfile?.reviewNote ?? null,
      },
      update: {
        riskScore,
        riskLevel,
        flags,
        totalDeposited,
        totalWithdrawn,
        totalPrizeEarned,
        totalEntryFeesPaid,
        tournamentCount: participants.length,
        winCount,
        disputeCount: disputes.length,
        rejectedPaymentCount: rejectedPayments,
        lastDepositAt: approvedDeposits[0]?.createdAt ?? null,
        lastWithdrawAt: withdrawals[0]?.createdAt ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        accountAgeDays,
        isBlacklisted,
        blacklistReason,
      },
    });
  }

  async checkWithdrawalRisk(userId: string, amount: number) {
    const profile = await this.buildRiskProfile(userId);

    if (profile.isBlacklisted) {
      return {
        profile,
        canAutoApprove: false,
        requiresManualReview: false,
        blockedReason: profile.blacklistReason ? `User blacklisted: ${profile.blacklistReason}` : "User blacklisted",
      };
    }

    if (profile.riskLevel === "CRITICAL") {
      return { profile, canAutoApprove: false, requiresManualReview: true };
    }

    if (amount > 500 && profile.riskLevel === "HIGH") {
      return { profile, canAutoApprove: false, requiresManualReview: true };
    }

    if (amount > 2000) {
      return { profile, canAutoApprove: false, requiresManualReview: true };
    }

    return {
      profile,
      canAutoApprove: profile.riskLevel === "LOW",
      requiresManualReview: profile.riskLevel !== "LOW",
    };
  }

  async checkDepositRisk(userId: string) {
    const profile = await this.buildRiskProfile(userId);
    if (profile.isBlacklisted) {
      return {
        profile,
        canApprove: false,
        blockedReason: profile.blacklistReason ? `User blacklisted: ${profile.blacklistReason}` : "User blacklisted",
      };
    }
    if (profile.riskLevel === "CRITICAL") {
      return { profile, canApprove: false, blockedReason: "CRITICAL risk — escalate to ADMIN" };
    }
    return { profile, canApprove: true };
  }

  async getRiskDetails(userId: string) {
    const [profile, transactions, participants, payments, withdrawals, disputes] = await Promise.all([
      this.buildRiskProfile(userId),
      this.prisma.walletTransaction.findMany({
        where: { wallet: { userId } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.tournamentParticipant.findMany({
        where: { userId },
        include: { tournament: { select: { id: true, title: true, status: true, createdAt: true } } },
        orderBy: { joinedAt: "desc" },
        take: 5,
      }),
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.withdrawalRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.challengeDispute.findMany({
        where: { raisedBy: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return { profile, transactions, participants, payments, withdrawals, disputes };
  }

  async listProfiles(filters: { riskLevel?: string; search?: string; blacklisted?: boolean }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters.search
          ? {
              email: { contains: filters.search, mode: "insensitive" },
            }
          : {}),
        ...(filters.blacklisted === true
          ? { financialRiskProfile: { isBlacklisted: true } }
          : filters.blacklisted === false
            ? { financialRiskProfile: { isBlacklisted: false } }
            : {}),
        ...(filters.riskLevel ? { financialRiskProfile: { riskLevel: filters.riskLevel } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
        financialRiskProfile: true,
      },
    });
  }

  async blacklistUser(userId: string, reason: string, adminId: string) {
    const [profile, user] = await Promise.all([
      this.buildRiskProfile(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, profile: { select: { freeFireUid: true } } },
      }),
    ]);
    if (!user) throw new NotFoundException("User not found");
    if (user.profile?.freeFireUid) {
      await this.profiles.blacklistFreeFireUid({
        freeFireUid: user.profile.freeFireUid,
        userId,
        reason,
      });
    }
    if (user.profile?.freeFireUid) {
      await this.prisma.playerProfile.update({
        where: { userId },
        data: { isBlacklisted: true, blacklistReason: reason },
      });
    }
    return this.prisma.financialRiskProfile.update({
      where: { userId },
      data: {
        isBlacklisted: true,
        blacklistReason: reason,
        reviewedBy: adminId,
        reviewNote: reason,
        riskScore: Math.max(profile.riskScore, 95),
        riskLevel: "CRITICAL",
      },
    });
  }

  async removeBlacklist(userId: string, adminId: string) {
    const [profile, user] = await Promise.all([
      this.buildRiskProfile(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, profile: { select: { freeFireUid: true } } },
      }),
    ]);
    if (!user) throw new NotFoundException("User not found");
    if (user.profile?.freeFireUid) {
      await this.profiles.removeFreeFireUidBlacklist(user.profile.freeFireUid);
      await this.prisma.playerProfile.update({
        where: { userId },
        data: { isBlacklisted: false, blacklistReason: null },
      });
    }
    return this.prisma.financialRiskProfile.update({
      where: { userId },
      data: {
        isBlacklisted: false,
        blacklistReason: null,
        reviewedBy: adminId,
        reviewNote: profile.reviewNote,
        riskScore: profile.riskScore,
        riskLevel: profile.riskLevel,
      },
    });
  }
}