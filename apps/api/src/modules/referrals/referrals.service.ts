import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { SystemConfigService } from "../admin/system-config.service";
import { RealtimeService } from "../../common/realtime/realtime.service";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

@Injectable()
export class ReferralsService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private config: SystemConfigService,
    private realtime: RealtimeService,
  ) {}

  normalizeCode(code?: string | null) {
    return (code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  async generateUniqueCode(tx?: any): Promise<string> {
    const client = tx ?? this.prisma;
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = Array.from({ length: 6 }, () =>
        CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
      ).join("");
      const existing = await client.user.findUnique({ where: { referralCode: code } });
      if (!existing) return code;
    }
    throw new BadRequestException("Could not generate referral code");
  }

  async ensureUserCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.referralCode) return user.referralCode;
    const code = await this.generateUniqueCode();
    await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
    return code;
  }

  async validateCodeForSignup(code?: string | null) {
    if (!this.config.getBool("REFERRAL_ENABLED")) return null;
    const normalized = this.normalizeCode(code);
    if (!normalized) return null;
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      throw new BadRequestException("Referral code must be 6 letters or digits");
    }
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: normalized },
      select: { id: true, referralCode: true, isBanned: true },
    });
    if (!referrer || referrer.isBanned) {
      throw new BadRequestException("Invalid referral code");
    }
    return referrer;
  }

  async attachSignupReferral(referredId: string, code?: string | null) {
    const enabled = this.config.getBool("REFERRAL_ENABLED");
    const normalized = this.normalizeCode(code);
    if (!enabled || !normalized) return null;

    return this.prisma.$transaction(async (tx: any) => {
      const referred = await tx.user.findUnique({
        where: { id: referredId },
        select: { id: true, referralCode: true },
      });
      if (!referred) throw new NotFoundException("User not found");
      const referrer = await tx.user.findUnique({
        where: { referralCode: normalized },
        select: { id: true, isBanned: true },
      });
      if (!referrer || referrer.isBanned || referrer.id === referredId) {
        throw new BadRequestException("Invalid referral code");
      }

      const existing = await tx.referral.findUnique({ where: { referredId } });
      if (existing) return existing;

      const signupReward = this.config.getNumber("REFERRAL_SIGNUP_REWARD_NPR");
      const referral = await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredId,
          codeUsed: normalized,
          signupRewardNpr: signupReward,
          referrerDepositRewardNpr: this.config.getNumber("REFERRAL_FIRST_DEPOSIT_REWARD_NPR"),
          signupRewardedAt: signupReward > 0 ? new Date() : null,
        },
      });

      if (signupReward > 0) {
        const wallet = await tx.wallet.upsert({
          where: { userId: referredId },
          create: { userId: referredId, balanceNpr: signupReward },
          update: { balanceNpr: { increment: signupReward } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "CREDIT",
            reason: "ADJUSTMENT",
            amountNpr: signupReward,
            note: `Referral signup bonus (${normalized})`,
          },
        });
        await tx.notification.create({
          data: {
            userId: referredId,
            type: "WALLET",
            title: "Referral bonus added",
            body: `Rs ${signupReward} added for joining with a referral code.`,
          },
        });
      }

      return referral;
    });
  }

  async rewardReferrerForFirstDeposit(tx: any, referredId: string, paymentId: string) {
    if (!this.config.getBool("REFERRAL_ENABLED")) return null;

    const referral = await tx.referral.findUnique({ where: { referredId } });
    if (!referral || referral.depositRewardedAt) return null;

    const firstApprovedWalletDeposit = await tx.payment.findFirst({
      where: {
        userId: referredId,
        tournamentId: null,
        status: "APPROVED",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!firstApprovedWalletDeposit) return null;

    const amount = this.config.getNumber("REFERRAL_FIRST_DEPOSIT_REWARD_NPR");
    if (amount <= 0) return null;

    const wallet = await tx.wallet.upsert({
      where: { userId: referral.referrerId },
      create: { userId: referral.referrerId, balanceNpr: amount },
      update: { balanceNpr: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
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
    this.realtime.emitToUser(referral.referrerId, "wallet_updated", {});
    return { ok: true };
  }

  async myReferral(userId: string) {
    const code = await this.ensureUserCode(userId);
    const [made, received] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: "desc" },
        include: {
          referred: {
            select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
          },
        },
        take: 100,
      }),
      this.prisma.referral.findUnique({ where: { referredId: userId } }),
    ]);
    const signupReward = this.config.getNumber("REFERRAL_SIGNUP_REWARD_NPR");
    const depositReward = this.config.getNumber("REFERRAL_FIRST_DEPOSIT_REWARD_NPR");
    return {
      code,
      enabled: this.config.getBool("REFERRAL_ENABLED"),
      signupRewardNpr: signupReward,
      referrerDepositRewardNpr: depositReward,
      received,
      stats: {
        invited: made.length,
        firstDeposits: made.filter((r) => !!r.depositRewardedAt).length,
        earnedNpr: made.reduce((sum, r) => sum + (r.referrerDepositRewardNpr ?? 0), 0),
      },
      referrals: made.map((r) => ({
        id: r.id,
        player: r.referred,
        joinedAt: r.createdAt,
        firstDepositRewarded: !!r.depositRewardedAt,
        rewardNpr: r.depositRewardedAt ? r.referrerDepositRewardNpr : 0,
      })),
      warning:
        "No multiple accounts. Self-referrals, fake accounts, and suspicious deposits can be reversed and may lead to a ban.",
    };
  }

  async claimSignupReferral(userId: string, code?: string | null) {
    if (!this.config.getBool("REFERRAL_ENABLED")) {
      throw new BadRequestException("Referral program is currently disabled");
    }
    const normalized = this.normalizeCode(code);
    if (!normalized) {
      throw new BadRequestException("Referral code is required");
    }
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      throw new BadRequestException("Referral code must be 6 letters or digits");
    }

    const existing = await this.prisma.referral.findUnique({ where: { referredId: userId } });
    if (existing) {
      throw new BadRequestException("Referral already claimed for this account");
    }

    await this.attachSignupReferral(userId, normalized);
    return this.myReferral(userId);
  }

  async adminSummary() {
    const [total, signupRewarded, firstDepositRewarded, recent] = await Promise.all([
      this.prisma.referral.count(),
      this.prisma.referral.count({ where: { signupRewardedAt: { not: null } } }),
      this.prisma.referral.count({ where: { depositRewardedAt: { not: null } } }),
      this.prisma.referral.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          referrer: { select: { id: true, email: true, name: true, profile: true } },
          referred: { select: { id: true, email: true, name: true, profile: true } },
        },
      }),
    ]);
    return {
      enabled: this.config.getBool("REFERRAL_ENABLED"),
      signupRewardNpr: this.config.getNumber("REFERRAL_SIGNUP_REWARD_NPR"),
      referrerDepositRewardNpr: this.config.getNumber("REFERRAL_FIRST_DEPOSIT_REWARD_NPR"),
      total,
      signupRewarded,
      firstDepositRewarded,
      recent,
    };
  }
}
