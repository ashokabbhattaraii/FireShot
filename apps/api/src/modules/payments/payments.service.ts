import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentStatus, PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { MemoryCacheService } from "../../common/cache/memory-cache.service";
import { invalidateTournamentCaches } from "../tournaments/tournament-cache.keys";
import { FinancialRiskService } from "../finance/financial-risk.service";
import { ReferralsService } from "../referrals/referrals.service";
import { SystemConfigService } from "../admin/system-config.service";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private cache: MemoryCacheService,
    private risk: FinancialRiskService,
    private referrals: ReferralsService,
    private config: SystemConfigService,
  ) {}

  async submit(
    userId: string,
    body: {
      tournamentId?: string;
      method: string;
      reference?: string;
      amountNpr: number;
    },
    fileUrl: string,
  ) {
    if (!body.tournamentId) {
      throw new BadRequestException("tournamentId required");
    }
    return this.prisma.payment.create({
      data: {
        userId,
        tournamentId: body.tournamentId,
        amountNpr: Number(body.amountNpr),
        method: body.method ?? "esewa",
        reference: body.reference,
        proofUrl: fileUrl,
        status: PaymentStatus.PENDING,
      },
    });
  }

  async deposit(
    userId: string,
    body: { method: string; reference?: string; amountNpr: number },
    fileUrl: string,
  ) {
    const amountNpr = Number(body.amountNpr);
    const minDeposit = this.config.getNumber("MIN_DEPOSIT_AMOUNT_NPR");
    if (!Number.isFinite(amountNpr) || amountNpr < minDeposit) {
      throw new BadRequestException(`Deposit amount must be at least NPR ${minDeposit}`);
    }
    return this.prisma.payment.create({
      data: {
        userId,
        amountNpr,
        method: body.method ?? "esewa",
        reference: body.reference,
        proofUrl: fileUrl,
        status: PaymentStatus.PENDING,
      },
    });
  }

  list(status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: status ? { status } : undefined,
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
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  myPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { tournament: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async approve(adminId: string, paymentId: string, reviewNote?: string) {
    const comment = this.requireComment(reviewNote, "reviewNote");
    let tournamentId: string | null = null;
    const result = await this.prisma.$transaction(async (tx: any) => {
      const p = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!p) throw new NotFoundException();
      if (p.status !== "PENDING")
        throw new BadRequestException("Already reviewed");
      tournamentId = p.tournamentId;
      const check = await this.risk.checkDepositRisk(p.userId);
      if (check.blockedReason) throw new BadRequestException(check.blockedReason);

      await tx.depositReview.create({
        data: {
          paymentId,
          reviewedBy: adminId,
          riskSnapshot: check.profile as any,
          reviewNote: comment,
          decision: "APPROVED",
        },
      });

      let resultingBalance: number | null = null;
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "APPROVED",
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      if (p.tournamentId) {
        await tx.tournamentParticipant.update({
          where: {
            tournamentId_userId: {
              tournamentId: p.tournamentId,
              userId: p.userId,
            },
          },
          data: { paid: true },
        });
        await tx.tournament.update({
          where: { id: p.tournamentId },
          data: { filledSlots: { increment: 1 } },
        });
      }
      if (!p.tournamentId) {
        const wallet = await tx.wallet.upsert({
          where: { userId: p.userId },
          update: { balanceNpr: { increment: p.amountNpr } },
          create: { userId: p.userId, balanceNpr: p.amountNpr },
        });
        resultingBalance = wallet.balanceNpr;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "CREDIT",
            reason: "ADJUSTMENT",
            amountNpr: p.amountNpr,
            note: comment,
          },
        });
        await this.referrals.rewardReferrerForFirstDeposit(tx, p.userId, p.id);
      }

      await tx.notification.create({
        data: {
          userId: p.userId,
          type: "PAYMENT",
          title:
            p.tournamentId
              ? "Payment approved"
              : "Deposit approved",
          body:
            p.tournamentId
              ? `Your payment of NPR ${p.amountNpr} has been approved. Room details are now visible. Reason: ${comment}`
              : `Your wallet deposit of NPR ${p.amountNpr} has been approved. New balance: NPR ${resultingBalance ?? p.amountNpr}. Reason: ${comment}`,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId,
          action: "APPROVE_PAYMENT",
          resource: "payment",
          resourceId: paymentId,
          newValue: { comment, amountNpr: p.amountNpr, resultingBalance },
        },
      });
      return { ok: true };
    });
    if (tournamentId) invalidateTournamentCaches(this.cache, tournamentId);
    return result;
  }

  async reject(adminId: string, paymentId: string, note?: string) {
    const comment = this.requireComment(note, "reason");
    const p = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!p) throw new NotFoundException();
    const profile = await this.risk.buildRiskProfile(p.userId);
    await this.prisma.depositReview.create({
      data: {
        paymentId,
        reviewedBy: adminId,
        riskSnapshot: profile as any,
        reviewNote: comment,
        decision: "REJECTED",
      },
    });
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: p.userId,
        type: "PAYMENT",
        title: "Payment rejected",
        body: `Your payment of NPR ${p.amountNpr} was rejected. Reason: ${comment}`,
      },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        action: "REJECT_PAYMENT",
        resource: "payment",
        resourceId: paymentId,
        newValue: { reason: comment },
      },
    });
    return { ok: true };
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
