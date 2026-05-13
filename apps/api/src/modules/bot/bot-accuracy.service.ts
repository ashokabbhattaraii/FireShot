import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "../admin/admin-action-log.service";

@Injectable()
export class BotAccuracyService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
  ) {}

  async recordReview(flagId: string, wasCorrect: boolean, note: string | undefined, adminId: string, ip?: string | null) {
    const flag = await this.prisma.botFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException();
    if (flag.wasCorrect !== null) throw new BadRequestException("Flag already reviewed");

    await this.prisma.botFlag.update({
      where: { id: flagId },
      data: {
        wasCorrect,
        reviewedBy: adminId,
        reviewNote: note,
        status: wasCorrect ? "REVIEWED_CORRECT" : "REVIEWED_WRONG",
        resolvedAt: new Date(),
      },
    });

    const job = await this.prisma.botJob.update({
      where: { name: flag.jobName },
      data: {
        truePositives: wasCorrect ? { increment: 1 } : undefined,
        falsePositives: wasCorrect ? undefined : { increment: 1 },
      },
    });

    const total = job.truePositives + job.falsePositives;
    const score = total === 0 ? 0 : (job.truePositives / total) * 100;
    const updated = await this.prisma.botJob.update({
      where: { name: flag.jobName },
      data: { accuracyScore: score },
    });

    await this.logs.log(
      adminId,
      "bot.flag_review",
      "bot_flag",
      flagId,
      null,
      { wasCorrect, note, accuracyScore: score },
      ip,
    );

    if (score < 60 && total >= 10) {
      await this.notifyAccuracyAlert(
        flag.jobName,
        score,
        `accuracy dropped to ${score.toFixed(1)}% — consider tightening thresholds`,
      );
    } else if (score >= 90 && total >= 50 && updated.dryRunEnabled) {
      await this.notifyAccuracyAlert(
        flag.jobName,
        score,
        `accuracy is ${score.toFixed(1)}% over ${total} reviews — safe to disable dry-run mode`,
      );
    }

    return { accuracyScore: score, truePositives: updated.truePositives, falsePositives: updated.falsePositives };
  }

  async ignoreFlag(flagId: string, adminId: string, ip?: string | null) {
    await this.prisma.botFlag.update({
      where: { id: flagId },
      data: { status: "IGNORED", reviewedBy: adminId, resolvedAt: new Date() },
    });
    await this.logs.log(adminId, "bot.flag_ignore", "bot_flag", flagId, null, null, ip);
    return { ok: true };
  }

  async listFlags(filters: { jobName?: string; status?: string; severity?: string }, page = 1, limit = 25) {
    const where: any = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) where[k] = v;
    });
    const [items, total] = await Promise.all([
      this.prisma.botFlag.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.botFlag.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private async notifyAccuracyAlert(jobName: string, score: number, msg: string) {
    const supers = await this.prisma.user.findMany({
      where: { roleRef: { name: "SUPER_ADMIN" } },
      select: { id: true },
    });
    for (const su of supers) {
      await this.prisma.notification.create({
        data: {
          userId: su.id,
          type: "SYSTEM",
          title: `Bot ${jobName} alert`,
          body: msg,
        },
      });
    }
  }
}
