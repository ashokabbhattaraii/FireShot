import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { BotJobService } from "./bot-job.service";

@Injectable()
export class BotSchedulerService {
  private readonly logger = new Logger("BotScheduler");

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private jobs: BotJobService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick() {
    let due: any[] = [];
    try {
      due = await this.prisma.botJob.findMany({
        where: {
          isEnabled: true,
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
          NOT: { lastRunStatus: "RUNNING" },
        },
      });
    } catch (e: any) {
      this.logger.warn(`Scheduler tick skipped: ${e.message}`);
      return;
    }

    for (const job of due) {
      this.logger.log(`Running ${job.name}`);
      this.jobs.runJob(job.name).catch((e) =>
        this.logger.error(`${job.name} failed: ${e.message}`),
      );
    }
  }
}
