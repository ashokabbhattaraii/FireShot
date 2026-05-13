import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "../admin/admin-action-log.service";

@Injectable()
export class BotRollbackService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
  ) {}

  async listRollbacks(filters: { jobName?: string; rolledBack?: boolean }, page = 1, limit = 25) {
    const where: any = {};
    if (filters.jobName) where.jobName = filters.jobName;
    if (filters.rolledBack !== undefined) where.rolledBack = filters.rolledBack;
    const [items, total] = await Promise.all([
      this.prisma.botRollback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.botRollback.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async rollback(rollbackId: string, adminId: string, ip?: string | null) {
    const r = await this.prisma.botRollback.findUnique({ where: { id: rollbackId } });
    if (!r) throw new NotFoundException();
    if (r.rolledBack) throw new BadRequestException("Already rolled back");

    let note = "";
    switch (r.action) {
      case "REFUND": {
        await this.reverseRefund(r);
        note = "Reversed refund credit";
        break;
      }
      case "TOURNAMENT_CANCEL": {
        await this.reverseTournamentCancel(r);
        note = "Restored tournament + reversed refunds";
        break;
      }
      case "RESTORE_BALANCE": {
        await this.reverseBalanceAdjust(r);
        note = "Reverted balance adjustment";
        break;
      }
      case "PAYMENT_EXPIRE": {
        await this.reversePaymentExpire(r);
        note = "Restored payment to PENDING";
        break;
      }
      case "NOTIFICATION_SENT":
        note = "Cannot rollback notifications — marked acknowledged only";
        break;
      default:
        throw new BadRequestException(`Cannot rollback action ${r.action}`);
    }

    await this.prisma.botRollback.update({
      where: { id: rollbackId },
      data: { rolledBack: true, rolledBackBy: adminId, rolledBackAt: new Date() },
    });
    await this.logs.log(adminId, "bot.rollback", r.targetType, r.targetId, r.afterState as any, r.beforeState as any, ip);
    return { ok: true, note };
  }

  async record(
    jobName: string,
    jobLogId: string,
    action: string,
    targetType: string,
    targetId: string,
    beforeState: any,
    afterState: any,
  ) {
    return this.prisma.botRollback.create({
      data: { jobName, jobLogId, action, targetType, targetId, beforeState, afterState },
    });
  }

  private async reverseRefund(r: any) {
    const before = r.beforeState as any;
    const after = r.afterState as any;
    const amount: number = after.refundAmount ?? before.refundAmount ?? 0;
    const userId: string = before.userId;
    if (!amount || !userId) throw new BadRequestException("Insufficient refund snapshot");
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException("Wallet missing");
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceNpr: { decrement: amount } },
    });
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT",
        reason: "ADJUSTMENT",
        amountNpr: amount,
        note: `Bot rollback: reverse refund of NPR ${amount}`,
      },
    });
  }

  private async reverseTournamentCancel(r: any) {
    const before = r.beforeState as any;
    const tournamentId = r.targetId;
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: before.status ?? "LIVE" },
    });
    const refunds: any[] = before.refunds ?? [];
    for (const ref of refunds) {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId: ref.userId } });
      if (!wallet) continue;
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceNpr: { decrement: ref.amount } },
      });
      await this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          reason: "ADJUSTMENT",
          amountNpr: ref.amount,
          note: `Bot rollback: tournament ${tournamentId} restored`,
        },
      });
    }
  }

  private async reverseBalanceAdjust(r: any) {
    const before = r.beforeState as any;
    const wallet = await this.prisma.wallet.findUnique({ where: { id: r.targetId } });
    if (!wallet) throw new BadRequestException("Wallet missing");
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceNpr: before.balanceNpr },
    });
  }

  private async reversePaymentExpire(r: any) {
    await this.prisma.payment.update({
      where: { id: r.targetId },
      data: { status: "PENDING" },
    });
  }
}
