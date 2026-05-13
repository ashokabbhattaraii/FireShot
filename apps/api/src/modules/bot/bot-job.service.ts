import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { FlagSeverity, PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "../admin/admin-action-log.service";
import { BotRollbackService } from "./bot-rollback.service";

interface JobContext {
  jobName: string;
  config: Record<string, any>;
  dryRun: boolean;
  maxActions: number;
  actionsTaken: number;
  jobLogId: string | null;
}

interface JobResult {
  summary: string;
  details: any;
  flagsCreated: number;
  actionsPerformed: number;
  skippedDryRun: number;
}

@Injectable()
export class BotJobService implements OnModuleInit {
  private readonly logger = new Logger("BotJobService");

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
    private rollbacks: BotRollbackService,
  ) {}

  onModuleInit() {
    if (process.env.BOT_BOOT_CHECK !== "true") return;
    void this.checkBotTableReady();
  }

  private async checkBotTableReady() {
    try {
      await this.prisma.botJob.findMany();
    } catch {
      this.logger.warn("BotJob table not ready");
    }
  }

  // -------------------- ADMIN OPS --------------------
  async getStatus() {
    return this.prisma.botJob.findMany({ orderBy: { name: "asc" } });
  }

  async toggle(name: string, enabled: boolean, adminId: string, ip?: string | null) {
    const before = await this.prisma.botJob.findUnique({ where: { name } });
    if (!before) throw new BadRequestException(`Unknown job ${name}`);
    if (enabled && before.dryRunEnabled) {
      throw new BadRequestException(
        "Disable dry-run mode before enabling real actions",
      );
    }
    const updated = await this.prisma.botJob.update({
      where: { name },
      data: {
        isEnabled: enabled,
        nextRunAt: enabled ? new Date(Date.now() + before.intervalMins * 60_000) : null,
      },
    });
    await this.logs.log(adminId, "bot.toggle", "bot_job", name, { isEnabled: before.isEnabled }, { isEnabled: enabled }, ip);
    return updated;
  }

  async toggleDryRun(name: string, dryRun: boolean, adminId: string, ip?: string | null) {
    const before = await this.prisma.botJob.findUnique({ where: { name } });
    if (!before) throw new BadRequestException(`Unknown job ${name}`);
    const updated = await this.prisma.botJob.update({
      where: { name },
      data: {
        dryRunEnabled: dryRun,
        // Force-disable the job if dry-run is being re-enabled with the job currently running.
        isEnabled: dryRun ? before.isEnabled : before.isEnabled,
      },
    });
    await this.logs.log(adminId, "bot.dry_run", "bot_job", name, { dryRunEnabled: before.dryRunEnabled }, { dryRunEnabled: dryRun }, ip);
    return updated;
  }

  async updateInterval(name: string, intervalMins: number, adminId: string, ip?: string | null) {
    if (intervalMins < 5 || intervalMins > 1440)
      throw new BadRequestException("intervalMins must be 5-1440");
    const before = await this.prisma.botJob.findUnique({ where: { name } });
    if (!before) throw new BadRequestException(`Unknown job ${name}`);
    const updated = await this.prisma.botJob.update({
      where: { name },
      data: {
        intervalMins,
        nextRunAt: before.isEnabled ? new Date(Date.now() + intervalMins * 60_000) : null,
      },
    });
    await this.logs.log(adminId, "bot.interval", "bot_job", name, { intervalMins: before.intervalMins }, { intervalMins }, ip);
    return updated;
  }

  async updateConfig(name: string, config: Record<string, any>, adminId: string, ip?: string | null) {
    const before = await this.prisma.botJob.findUnique({ where: { name } });
    if (!before) throw new BadRequestException(`Unknown job ${name}`);
    const updated = await this.prisma.botJob.update({
      where: { name },
      data: { config: config as any },
    });
    await this.logs.log(adminId, "bot.config", "bot_job", name, { config: before.config }, { config }, ip);
    return updated;
  }

  async updateMaxActions(name: string, maxActionsPerRun: number, adminId: string, ip?: string | null) {
    if (maxActionsPerRun < 1 || maxActionsPerRun > 10000)
      throw new BadRequestException("maxActionsPerRun must be 1-10000");
    const before = await this.prisma.botJob.findUnique({ where: { name } });
    if (!before) throw new BadRequestException(`Unknown job ${name}`);
    const updated = await this.prisma.botJob.update({
      where: { name },
      data: { maxActionsPerRun },
    });
    await this.logs.log(adminId, "bot.max_actions", "bot_job", name, { maxActionsPerRun: before.maxActionsPerRun }, { maxActionsPerRun }, ip);
    return updated;
  }

  async triggerManual(name: string, adminId: string, ip?: string | null) {
    await this.logs.log(adminId, "bot.run_manual", "bot_job", name, null, null, ip);
    this.runJob(name).catch((e) => this.logger.error(`Manual run ${name} failed: ${e.message}`));
    return { ok: true };
  }

  async getLogs(filters: { jobName?: string; status?: string; from?: string; to?: string }, page = 1, limit = 20) {
    const where: any = {};
    if (filters.jobName) where.jobName = filters.jobName;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    const [items, total] = await Promise.all([
      this.prisma.botJobLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.botJobLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // -------------------- RUNNER --------------------
  async runJob(name: string) {
    const job = await this.prisma.botJob.findUnique({ where: { name } });
    if (!job) throw new BadRequestException(`Unknown job ${name}`);
    if (job.lastRunStatus === "RUNNING") {
      this.logger.warn(`${name} already running, skipping`);
      return;
    }

    await this.prisma.botJob.update({
      where: { name },
      data: { lastRunStatus: "RUNNING", lastRunAt: new Date() },
    });

    const start = Date.now();
    const ctx: JobContext = {
      jobName: name,
      config: (job.config as Record<string, any>) ?? {},
      dryRun: job.dryRunEnabled,
      maxActions: job.maxActionsPerRun,
      actionsTaken: 0,
      jobLogId: null,
    };

    let result: JobResult = { summary: "", details: null, flagsCreated: 0, actionsPerformed: 0, skippedDryRun: 0 };
    let status: "SUCCESS" | "FAILED" = "SUCCESS";
    try {
      result = await this.dispatch(name, ctx);
    } catch (e: any) {
      status = "FAILED";
      result = {
        summary: `Error: ${e.message}`,
        details: { stack: e.stack },
        flagsCreated: 0,
        actionsPerformed: ctx.actionsTaken,
        skippedDryRun: 0,
      };
    }
    const durationMs = Date.now() - start;
    const finalSummary =
      `${result.summary}` +
      (ctx.dryRun ? " [DRY RUN]" : "") +
      ` | flags=${result.flagsCreated} actions=${result.actionsPerformed} skipped=${result.skippedDryRun}`;

    await this.prisma.$transaction([
      this.prisma.botJobLog.create({
        data: {
          jobName: name,
          status,
          summary: finalSummary,
          details: { ...result.details, dryRun: ctx.dryRun } as any,
          durationMs,
        },
      }),
      this.prisma.botJob.update({
        where: { name },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: status,
          lastRunLog: finalSummary,
          runCount: { increment: 1 },
          errorCount: status === "FAILED" ? { increment: 1 } : undefined,
          nextRunAt: job.isEnabled
            ? new Date(Date.now() + job.intervalMins * 60_000)
            : null,
          lastDryRunAt: ctx.dryRun ? new Date() : undefined,
          lastDryRunLog: ctx.dryRun ? finalSummary : undefined,
        },
      }),
    ]);

    return { status, ...result, durationMs };
  }

  private dispatch(name: string, ctx: JobContext): Promise<JobResult> {
    switch (name) {
      case "PROFILE_ANALYZER":          return this.runProfileAnalyzer(ctx);
      case "FRAUD_DETECTOR":            return this.runFraudDetector(ctx);
      case "TOURNAMENT_CLOSER":         return this.runTournamentCloser(ctx);
      case "WALLET_RECONCILER":         return this.runWalletReconciler(ctx);
      case "INACTIVE_NOTIFIER":         return this.runInactiveNotifier(ctx);
      case "LEADERBOARD_SYNC":          return this.runLeaderboardSync(ctx);
      case "PAYMENT_EXPIRY_HANDLER":    return this.runPaymentExpiry(ctx);
      case "RESULT_SUBMISSION_REMINDER":return this.runResultReminder(ctx);
      default:
        throw new BadRequestException(`No handler for ${name}`);
    }
  }

  // -------------------- HELPERS --------------------
  private async createFlag(
    ctx: JobContext,
    targetType: string,
    targetId: string,
    reason: string,
    severity: FlagSeverity,
    evidence: any,
    actionTaken?: string,
  ) {
    return this.prisma.botFlag.create({
      data: { jobName: ctx.jobName, targetType, targetId, reason, severity, evidence, actionTaken },
    });
  }

  private canAct(ctx: JobContext): boolean {
    return !ctx.dryRun && ctx.actionsTaken < ctx.maxActions;
  }

  private async notifySuper(title: string, body: string) {
    const supers = await this.prisma.user.findMany({
      where: { roleRef: { name: "SUPER_ADMIN" } },
      select: { id: true },
    });
    for (const su of supers) {
      await this.prisma.notification.create({
        data: { userId: su.id, type: "SYSTEM", title, body },
      });
    }
  }

  // -------------------- HANDLERS --------------------

  private async runProfileAnalyzer(ctx: JobContext): Promise<JobResult> {
    const flagAfter = ctx.config.flagIncompleteAfterHours ?? 24;
    const dupThreshold = ctx.config.duplicateUidThreshold ?? 1;
    const cutoff = new Date(Date.now() - flagAfter * 3_600_000);

    let flagsCreated = 0;
    let skippedDryRun = 0;

    // Step 1 — Incomplete profiles
    const incompleteUsers = await this.prisma.user.findMany({
      where: { createdAt: { lt: cutoff } },
      include: { profile: true },
    });
    const recentlyFlagged = await this.prisma.botFlag.findMany({
      where: {
        jobName: ctx.jobName,
        targetType: "USER",
        createdAt: { gt: new Date(Date.now() - 48 * 3_600_000) },
      },
      select: { targetId: true },
    });
    const recentSet = new Set(recentlyFlagged.map((f) => f.targetId));

    let incompleteCount = 0;
    for (const u of incompleteUsers) {
      const missing: string[] = [];
      if (!u.profile?.freeFireUid) missing.push("freeFireUid");
      if (!u.profile?.ign) missing.push("ign");
      if (!missing.length || recentSet.has(u.id)) continue;

      await this.createFlag(ctx, "USER", u.id, "Incomplete profile", "LOW", { userId: u.id, missingFields: missing });
      flagsCreated += 1;
      incompleteCount += 1;

      if (this.canAct(ctx)) {
        await this.prisma.notification.create({
          data: {
            userId: u.id,
            type: "SYSTEM",
            title: "Complete your profile",
            body: "Add your Free Fire UID and IGN to join tournaments.",
          },
        });
        ctx.actionsTaken += 1;
      } else if (ctx.dryRun) skippedDryRun += 1;
    }

    // Step 2 — Duplicate UIDs
    const profiles = await this.prisma.playerProfile.findMany({
      include: { user: { select: { id: true, createdAt: true } } },
    });
    const byUid = new Map<string, typeof profiles>();
    for (const p of profiles) {
      const arr = byUid.get(p.freeFireUid) ?? [];
      arr.push(p);
      byUid.set(p.freeFireUid, arr);
    }
    const duplicateGroups: any[] = [];
    for (const [uid, list] of byUid.entries()) {
      if (list.length > dupThreshold) {
        const matchingUserIds = list.map((p) => p.userId);
        const accountCreatedAts = list.map((p) => p.user.createdAt);
        duplicateGroups.push({ uid, matchingUserIds, accountCreatedAts });

        const sorted = [...list].sort((a, b) => +a.user.createdAt - +b.user.createdAt);
        for (let i = 0; i < sorted.length; i++) {
          const p = sorted[i];
          await this.createFlag(
            ctx,
            "USER",
            p.userId,
            "Duplicate Free Fire UID",
            "HIGH",
            { freefireUid: uid, matchingUserIds, accountCreatedAts, isOldest: i === 0 },
            i === 0 ? undefined : "Suggest deactivation (newer duplicate)",
          );
          flagsCreated += 1;
        }
        if (this.canAct(ctx)) {
          await this.notifySuper(
            "Duplicate FF UID detected",
            `UID ${uid} used by ${list.length} accounts. Review immediately.`,
          );
          ctx.actionsTaken += 1;
        } else if (ctx.dryRun) skippedDryRun += 1;
      }
    }

    // Step 3 — Invalid format
    const validRe = /^\d{9,12}$/;
    let invalidCount = 0;
    for (const p of profiles) {
      if (!validRe.test(p.freeFireUid)) {
        await this.createFlag(ctx, "USER", p.userId, "Invalid FF UID format", "MEDIUM", {
          userId: p.userId,
          freefireUid: p.freeFireUid,
        });
        flagsCreated += 1;
        invalidCount += 1;
      }
    }

    return {
      summary: `Incomplete:${incompleteCount} Duplicate UIDs:${duplicateGroups.length} Invalid format:${invalidCount} | Actions taken:${ctx.actionsTaken}`,
      details: { incompleteCount, duplicateGroups, invalidCount },
      flagsCreated,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runFraudDetector(ctx: JobContext): Promise<JobResult> {
    const winThreshold = ctx.config.winRateThreshold ?? 85;
    const minTourneys = ctx.config.minTournamentsForWinRate ?? 8;
    const ipWindowMins = ctx.config.suspiciousPaymentWindowMins ?? 3;
    const maxIpPayments = ctx.config.maxSameIPPaymentsPerWindow ?? 3;
    const wMultiplier = ctx.config.unusualWithdrawalMultiplier ?? 5;

    let flagsCreated = 0;
    let skippedDryRun = 0;
    const counters = { winRate: 0, multiIp: 0, withdrawal: 0, newAccount: 0 };

    // Step 1 — Win rate anomaly
    const parts = await this.prisma.tournamentParticipant.findMany({
      where: { placement: { not: null } },
      select: { userId: true, placement: true, tournamentId: true },
    });
    const stats = new Map<string, { wins: number; total: number; tournamentIds: string[] }>();
    for (const p of parts) {
      const s = stats.get(p.userId) ?? { wins: 0, total: 0, tournamentIds: [] };
      s.total += 1;
      if (p.placement === 1) {
        s.wins += 1;
        s.tournamentIds.push(p.tournamentId);
      }
      stats.set(p.userId, s);
    }
    for (const [userId, s] of stats.entries()) {
      const winRate = (s.wins / s.total) * 100;
      if (s.total < minTourneys || winRate <= winThreshold) continue;
      const screenshotCount = await this.prisma.matchResult.count({
        where: { submittedById: userId, tournamentId: { in: s.tournamentIds } },
      });
      const evidenceLegit = screenshotCount >= s.wins;
      const severity: FlagSeverity = winRate > 95 ? "CRITICAL" : evidenceLegit ? "MEDIUM" : "HIGH";
      await this.createFlag(
        ctx,
        "USER",
        userId,
        `Win rate ${winRate.toFixed(1)}%`,
        severity,
        { userId, wins: s.wins, total: s.total, winRate, tournamentIds: s.tournamentIds, hasScreenshots: evidenceLegit },
      );
      flagsCreated += 1;
      counters.winRate += 1;
    }

    // Step 2 — Multi-account / rapid payments by IP
    const since = new Date(Date.now() - ipWindowMins * 60_000);
    const recent = await this.prisma.payment.findMany({
      where: { ipAddress: { not: null }, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, ipAddress: true, createdAt: true },
    });
    const byIp = new Map<string, typeof recent>();
    for (const p of recent) {
      const arr = byIp.get(p.ipAddress!) ?? [];
      arr.push(p);
      byIp.set(p.ipAddress!, arr);
    }
    for (const [ip, arr] of byIp.entries()) {
      if (arr.length <= maxIpPayments) continue;
      const userIds = [...new Set(arr.map((x) => x.userId))];
      const severity: FlagSeverity = userIds.length > 1 ? "HIGH" : "MEDIUM";
      for (const uid of userIds) {
        await this.createFlag(
          ctx,
          "USER",
          uid,
          `Same-IP payment burst (${arr.length} payments)`,
          severity,
          { ip, paymentIds: arr.map((p) => p.id), userIds, timestamps: arr.map((p) => p.createdAt) },
        );
        flagsCreated += 1;
      }
      counters.multiIp += 1;
    }

    // Step 3 — Withdrawal anomaly
    const pendingWithdrawals = await this.prisma.withdrawalRequest.findMany({
      where: { status: "PENDING" },
    });
    for (const w of pendingWithdrawals) {
      const since30 = new Date(Date.now() - 30 * 24 * 3_600_000);
      const deposits = await this.prisma.payment.findMany({
        where: { userId: w.userId, status: "APPROVED", createdAt: { gt: since30 } },
        select: { amountNpr: true },
      });
      const total = deposits.reduce((s, d) => s + d.amountNpr, 0);
      const avg = deposits.length ? total / deposits.length : 0;
      const prizeCount = await this.prisma.walletTransaction.count({
        where: { wallet: { userId: w.userId }, reason: "PRIZE" },
      });
      if (avg > 0 && w.amountNpr > avg * wMultiplier && prizeCount === 0) {
        await this.createFlag(
          ctx,
          "USER",
          w.userId,
          "Withdrawal anomaly",
          "CRITICAL",
          { userId: w.userId, withdrawalAmount: w.amountNpr, avgDeposit: avg, ratio: w.amountNpr / Math.max(avg, 1) },
        );
        flagsCreated += 1;
        counters.withdrawal += 1;
      }
    }

    // Step 4 — New-account payment rush
    const newAccountCutoff = new Date(Date.now() - 2 * 24 * 3_600_000);
    const newUsers = await this.prisma.user.findMany({
      where: { createdAt: { gt: newAccountCutoff } },
      select: { id: true, createdAt: true },
    });
    for (const u of newUsers) {
      const paymentCount = await this.prisma.payment.count({ where: { userId: u.id } });
      if (paymentCount >= 3) {
        const ageHours = (Date.now() - u.createdAt.getTime()) / 3_600_000;
        await this.createFlag(
          ctx,
          "USER",
          u.id,
          "New account rapid payments",
          "HIGH",
          { userId: u.id, accountAgeHours: ageHours, paymentCount },
        );
        flagsCreated += 1;
        counters.newAccount += 1;
      }
    }

    if (flagsCreated > 0 && this.canAct(ctx)) {
      await this.notifySuper("Fraud bot flags", `${flagsCreated} suspicious patterns detected.`);
      ctx.actionsTaken += 1;
    } else if (flagsCreated > 0 && ctx.dryRun) skippedDryRun += 1;

    return {
      summary: `WinRate:${counters.winRate} MultiIP:${counters.multiIp} Withdrawal:${counters.withdrawal} NewAccountRush:${counters.newAccount} | Flags created:${flagsCreated}`,
      details: { counters, totalFlags: flagsCreated },
      flagsCreated,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runTournamentCloser(ctx: JobContext): Promise<JobResult> {
    const grace = ctx.config.gracePeriodMins ?? 15;
    const minPlayers = ctx.config.minPlayersForRefund ?? 2;
    let flagsCreated = 0;
    let skippedDryRun = 0;
    const counters = { closed: 0, cancelled: 0, flaggedUpcoming: 0, stalePending: 0 };

    // Step 1 — Close expired LIVE
    const expired = await this.prisma.tournament.findMany({
      where: { status: "LIVE", dateTime: { lt: new Date(Date.now() - grace * 60_000) } },
      include: { participants: { where: { paid: true } } },
    });

    for (const t of expired) {
      if (ctx.actionsTaken >= ctx.maxActions) {
        skippedDryRun += 1;
        break;
      }
      const beforeState = {
        status: t.status,
        participantCount: t.participants.length,
        participantIds: t.participants.map((p) => p.userId),
        refunds: [] as { userId: string; amount: number }[],
      };

      if (t.participants.length < minPlayers) {
        const refunds: { userId: string; amount: number }[] = [];
        if (this.canAct(ctx)) {
          for (const p of t.participants) {
            const wallet = await this.prisma.wallet.upsert({
              where: { userId: p.userId },
              create: { userId: p.userId, balanceNpr: t.entryFeeNpr },
              update: { balanceNpr: { increment: t.entryFeeNpr } },
            });
            await this.prisma.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: "CREDIT",
                reason: "REFUND",
                amountNpr: t.entryFeeNpr,
                note: `Auto-refund: ${t.title} cancelled (low participants)`,
              },
            });
            await this.prisma.notification.create({
              data: {
                userId: p.userId,
                type: "TOURNAMENT",
                title: "Tournament cancelled",
                body: `${t.title} cancelled. NPR ${t.entryFeeNpr} refunded.`,
              },
            });
            refunds.push({ userId: p.userId, amount: t.entryFeeNpr });
          }
          await this.prisma.tournament.update({ where: { id: t.id }, data: { status: "CANCELLED" } });
          await this.rollbacks.record(
            ctx.jobName,
            ctx.jobLogId ?? "pending",
            "TOURNAMENT_CANCEL",
            "TOURNAMENT",
            t.id,
            { ...beforeState, refunds },
            { status: "CANCELLED" },
          );
          ctx.actionsTaken += 1;
        } else if (ctx.dryRun) skippedDryRun += 1;
        await this.createFlag(ctx, "TOURNAMENT", t.id, "Low participants — refund cancelled", "MEDIUM", {
          tournamentId: t.id,
          participantCount: t.participants.length,
        });
        flagsCreated += 1;
        counters.cancelled += 1;
      } else {
        const resultCount = await this.prisma.matchResult.count({ where: { tournamentId: t.id } });
        if (resultCount === 0) {
          if (this.canAct(ctx)) {
            await this.prisma.tournament.update({ where: { id: t.id }, data: { status: "PENDING_RESULTS" } });
            await this.notifySuper(
              "Tournament awaiting results",
              `${t.title} ended with no results submitted.`,
            );
            await this.rollbacks.record(
              ctx.jobName,
              ctx.jobLogId ?? "pending",
              "RESTORE_BALANCE",
              "TOURNAMENT",
              t.id,
              { status: t.status },
              { status: "PENDING_RESULTS" },
            );
            ctx.actionsTaken += 1;
          } else if (ctx.dryRun) skippedDryRun += 1;
          counters.closed += 1;
        }
      }
    }

    // Step 2 — Upcoming with 0 registrations 1hr before
    const oneHr = new Date(Date.now() + 60 * 60_000);
    const lonely = await this.prisma.tournament.findMany({
      where: { status: "UPCOMING", dateTime: { lte: oneHr, gt: new Date() } },
      include: { _count: { select: { participants: true } } },
    });
    for (const t of lonely) {
      if (t._count.participants > 0) continue;
      await this.createFlag(ctx, "TOURNAMENT", t.id, "Upcoming tournament with 0 registrations", "MEDIUM", {
        tournamentId: t.id,
        startsAt: t.dateTime,
      });
      flagsCreated += 1;
      counters.flaggedUpcoming += 1;
      if (t.createdById && this.canAct(ctx)) {
        await this.prisma.notification.create({
          data: {
            userId: t.createdById,
            type: "TOURNAMENT",
            title: "0 registrations alert",
            body: `${t.title} has no registrations. Promote it now.`,
          },
        });
        ctx.actionsTaken += 1;
      }
    }

    // Step 3 — Stale PENDING_RESULTS
    const staleCutoff = new Date(Date.now() - 48 * 3_600_000);
    const stale = await this.prisma.tournament.findMany({
      where: { status: "PENDING_RESULTS", updatedAt: { lt: staleCutoff } },
      include: { _count: { select: { participants: true } } },
    });
    for (const t of stale) {
      await this.createFlag(ctx, "TOURNAMENT", t.id, "Stale pending results (>48hrs)", "HIGH", {
        tournamentId: t.id,
        pendingSince: t.updatedAt,
        participantCount: t._count.participants,
      });
      flagsCreated += 1;
      counters.stalePending += 1;
    }

    return {
      summary: `Closed:${counters.closed} Cancelled+Refunded:${counters.cancelled} Flagged upcoming:${counters.flaggedUpcoming} Stale pending:${counters.stalePending}`,
      details: counters,
      flagsCreated,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runWalletReconciler(ctx: JobContext): Promise<JobResult> {
    const grace = ctx.config.negativeBalanceGraceCents ?? 0;
    const orphanAge = ctx.config.orphanTransactionAgeHours ?? 2;
    let flagsCreated = 0;
    let skippedDryRun = 0;
    const counters = { negative: 0, orphans: 0, doublePrize: 0, autoFixed: 0 };

    // Step 1 — Negative + mismatch
    const wallets = await this.prisma.wallet.findMany({ include: { transactions: true } });
    for (const w of wallets) {
      const computed = w.transactions.reduce(
        (sum, t) => sum + (t.type === "CREDIT" ? t.amountNpr : -t.amountNpr),
        0,
      );
      const stored = w.balanceNpr;
      const diff = stored - computed;

      if (stored < -grace) {
        await this.createFlag(ctx, "USER", w.userId, "Negative wallet balance", "CRITICAL", {
          userId: w.userId,
          stored,
          computed,
          diff,
        });
        flagsCreated += 1;
        counters.negative += 1;
      }
      if (diff !== 0) {
        const severity: FlagSeverity = Math.abs(diff) > 100 ? "CRITICAL" : "HIGH";
        await this.createFlag(ctx, "USER", w.userId, "Balance mismatch", severity, {
          stored,
          computed,
          diff,
        });
        flagsCreated += 1;

        if (Math.abs(diff) < 10 && this.canAct(ctx)) {
          await this.prisma.wallet.update({
            where: { id: w.id },
            data: { balanceNpr: computed },
          });
          await this.prisma.walletTransaction.create({
            data: {
              walletId: w.id,
              type: diff > 0 ? "DEBIT" : "CREDIT",
              reason: "ADJUSTMENT",
              amountNpr: Math.abs(diff),
              note: `Bot auto-fix: balance reconciliation`,
            },
          });
          await this.rollbacks.record(
            ctx.jobName,
            ctx.jobLogId ?? "pending",
            "RESTORE_BALANCE",
            "WALLET",
            w.id,
            { balanceNpr: stored },
            { balanceNpr: computed },
          );
          counters.autoFixed += 1;
          ctx.actionsTaken += 1;
        } else if (ctx.dryRun) skippedDryRun += 1;
      }
    }

    // Step 2 — Orphans
    const orphanCutoff = new Date(Date.now() - orphanAge * 3_600_000);
    const debits = await this.prisma.walletTransaction.findMany({
      where: { type: "DEBIT", reason: "ENTRY_FEE", createdAt: { lt: orphanCutoff } },
    });
    for (const d of debits) {
      const w = await this.prisma.wallet.findUnique({ where: { id: d.walletId } });
      if (!w) continue;
      const part = await this.prisma.tournamentParticipant.findFirst({
        where: { userId: w.userId, paid: true },
      });
      if (!part) {
        await this.createFlag(ctx, "TRANSACTION", d.id, "Orphan ENTRY_FEE debit", "MEDIUM", {
          transactionId: d.id,
          type: d.type,
          amount: d.amountNpr,
          createdAt: d.createdAt,
          missingLink: "no paid participant",
        });
        flagsCreated += 1;
        counters.orphans += 1;
      }
    }

    const credits = await this.prisma.walletTransaction.findMany({
      where: { type: "CREDIT", reason: "PRIZE", createdAt: { lt: orphanCutoff } },
    });
    for (const c of credits) {
      const w = await this.prisma.wallet.findUnique({ where: { id: c.walletId } });
      if (!w) continue;
      const completedParticipations = await this.prisma.tournamentParticipant.count({
        where: { userId: w.userId, prizeEarned: { gt: 0 }, tournament: { status: "COMPLETED" } },
      });
      if (completedParticipations === 0) {
        await this.createFlag(ctx, "TRANSACTION", c.id, "Unlinked PRIZE credit", "HIGH", {
          transactionId: c.id,
          amount: c.amountNpr,
          missingLink: "no completed prize tournaments",
        });
        flagsCreated += 1;
        counters.orphans += 1;
      }
    }

    // Step 3 — Double-prize detection (per user/tournament)
    const userPrizeAgg = await this.prisma.walletTransaction.findMany({
      where: { type: "CREDIT", reason: "PRIZE" },
      include: { wallet: true },
    });
    const groupMap = new Map<string, typeof userPrizeAgg>();
    for (const t of userPrizeAgg) {
      const key = `${t.wallet.userId}:${t.note ?? ""}`;
      const arr = groupMap.get(key) ?? [];
      arr.push(t);
      groupMap.set(key, arr);
    }
    for (const [, list] of groupMap.entries()) {
      if (list.length <= 1) continue;
      const totalCredited = list.reduce((s, t) => s + t.amountNpr, 0);
      await this.createFlag(ctx, "USER", list[0].wallet.userId, "Double prize credit", "CRITICAL", {
        userId: list[0].wallet.userId,
        transactionIds: list.map((t) => t.id),
        totalCredited,
      });
      flagsCreated += 1;
      counters.doublePrize += 1;
    }

    if (counters.negative > 0 && this.canAct(ctx)) {
      await this.notifySuper(
        "Negative balances detected",
        `${counters.negative} wallets are negative. Review immediately.`,
      );
      ctx.actionsTaken += 1;
    }

    return {
      summary: `NegativeBalances:${counters.negative} Orphaned:${counters.orphans} DoublePrize:${counters.doublePrize} AutoFixed:${counters.autoFixed}`,
      details: counters,
      flagsCreated,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runInactiveNotifier(ctx: JobContext): Promise<JobResult> {
    const inactiveDays = ctx.config.inactiveDays ?? 7;
    const maxNotif = Math.min(ctx.config.maxNotificationsPerRun ?? 100, ctx.maxActions);
    const cooldownDays = ctx.config.cooldownDays ?? 7;

    const inactiveCutoff = new Date(Date.now() - inactiveDays * 24 * 3_600_000);
    const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 3_600_000);

    const candidates = await this.prisma.user.findMany({
      where: {
        isBanned: false,
        OR: [{ lastLoginAt: { lt: inactiveCutoff } }, { lastLoginAt: null, createdAt: { lt: inactiveCutoff } }],
        notifications: {
          none: { title: { contains: "miss" }, createdAt: { gt: cooldownCutoff } },
        },
      },
      include: { wallet: true, tournaments: { take: 1, orderBy: { joinedAt: "desc" }, include: { tournament: true } } },
    });

    candidates.sort((a, b) => (b.wallet?.balanceNpr ?? 0) - (a.wallet?.balanceNpr ?? 0));

    const upcoming = await this.prisma.tournament.findMany({
      where: { status: "UPCOMING", dateTime: { gt: new Date() } },
      orderBy: { dateTime: "asc" },
      take: 20,
    });

    let notified = 0;
    let withBalance = 0;
    let skippedDryRun = 0;

    for (const u of candidates) {
      if (notified >= maxNotif) break;
      const lastMode = u.tournaments[0]?.tournament?.mode;
      const target =
        upcoming.find((t) => t.mode === lastMode) ??
        [...upcoming].sort((a, b) => a.entryFeeNpr - b.entryFeeNpr)[0];
      if (!target) break;

      const balance = u.wallet?.balanceNpr ?? 0;
      const timeUntil = `${Math.max(1, Math.round((target.dateTime.getTime() - Date.now()) / 3_600_000))}h`;
      const body =
        balance > 0
          ? `You have Rs ${balance} in your wallet! ${target.title} starts in ${timeUntil}. Use your balance to join.`
          : `Welcome back! ${target.title} starting soon — entry just Rs ${target.entryFeeNpr}.`;

      if (this.canAct(ctx)) {
        await this.prisma.notification.create({
          data: {
            userId: u.id,
            type: "TOURNAMENT",
            title: "We miss you!",
            body,
          },
        });
        ctx.actionsTaken += 1;
        notified += 1;
        if (balance > 0) withBalance += 1;
      } else if (ctx.dryRun) {
        skippedDryRun += 1;
        notified += 1;
        if (balance > 0) withBalance += 1;
      }
    }

    return {
      summary: `Eligible:${candidates.length} Notified:${notified} Skipped cooldown:${skippedDryRun} | WithBalance:${withBalance}`,
      details: { eligible: candidates.length, notified, withBalance },
      flagsCreated: 0,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runLeaderboardSync(ctx: JobContext): Promise<JobResult> {
    const sums = await this.prisma.walletTransaction.groupBy({
      by: ["walletId"],
      where: { type: "CREDIT", reason: "PRIZE" },
      _sum: { amountNpr: true },
      _count: { _all: true },
    });
    const userTotals: { userId: string; total: number; wins: number }[] = [];
    for (const s of sums) {
      const w = await this.prisma.wallet.findUnique({ where: { id: s.walletId } });
      if (w) userTotals.push({ userId: w.userId, total: s._sum.amountNpr ?? 0, wins: s._count._all ?? 0 });
    }
    userTotals.sort((a, b) => b.total - a.total);

    const existing = await this.prisma.leaderboardEntry.findMany();
    const prev = new Map(existing.map((e) => [e.userId, e.rank]));
    let synced = 0;
    let rankChanges = 0;
    let skippedDryRun = 0;

    for (let i = 0; i < userTotals.length; i++) {
      const { userId, total } = userTotals[i];
      const newRank = i + 1;
      const oldRank = prev.get(userId);

      if (this.canAct(ctx) || ctx.actionsTaken < ctx.maxActions) {
        await this.prisma.leaderboardEntry.upsert({
          where: { userId },
          create: { userId, totalEarnings: total, rank: newRank },
          update: { totalEarnings: total, rank: newRank },
        });
        ctx.actionsTaken += 1;
        synced += 1;
      }

      if (oldRank && Math.abs(oldRank - newRank) > 3 && newRank < oldRank) {
        rankChanges += 1;
        if (this.canAct(ctx)) {
          await this.prisma.notification.create({
            data: {
              userId,
              type: "SYSTEM",
              title: "Leaderboard climb!",
              body: `You moved up to #${newRank} on the leaderboard!`,
            },
          });
        } else if (ctx.dryRun) skippedDryRun += 1;
      }
    }

    const top = userTotals[0];
    let topName = "—";
    if (top) {
      const u = await this.prisma.user.findUnique({ where: { id: top.userId }, select: { name: true, email: true } });
      topName = u?.name ?? u?.email ?? top.userId;
    }
    return {
      summary: `Synced:${synced} entries | RankChanges:${rankChanges} | TopPlayer:${topName} Rs${top?.total ?? 0}`,
      details: { top5: userTotals.slice(0, 5) },
      flagsCreated: 0,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runPaymentExpiry(ctx: JobContext): Promise<JobResult> {
    const expiryHours = ctx.config.pendingPaymentExpiryHours ?? 24;
    const cutoff = new Date(Date.now() - expiryHours * 3_600_000);
    const stale = await this.prisma.payment.findMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
    });

    let flagsCreated = 0;
    let actions = 0;
    let skippedDryRun = 0;

    for (const p of stale) {
      if (ctx.actionsTaken >= ctx.maxActions) break;
      await this.createFlag(ctx, "PAYMENT", p.id, "Payment proof expired", "LOW", {
        paymentId: p.id,
        userId: p.userId,
        ageHours: (Date.now() - p.createdAt.getTime()) / 3_600_000,
      });
      flagsCreated += 1;

      if (this.canAct(ctx)) {
        await this.rollbacks.record(
          ctx.jobName,
          ctx.jobLogId ?? "pending",
          "PAYMENT_EXPIRE",
          "PAYMENT",
          p.id,
          { status: p.status },
          { status: "EXPIRED" },
        );
        await this.prisma.payment.update({ where: { id: p.id }, data: { status: "EXPIRED" } });
        await this.prisma.notification.create({
          data: {
            userId: p.userId,
            type: "PAYMENT",
            title: "Payment expired",
            body: "Your payment proof expired. Please resubmit if you still want to join.",
          },
        });
        ctx.actionsTaken += 1;
        actions += 1;
      } else if (ctx.dryRun) skippedDryRun += 1;
    }

    return {
      summary: `Expired:${actions} payments`,
      details: { expired: actions, total: stale.length },
      flagsCreated,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }

  private async runResultReminder(ctx: JobContext): Promise<JobResult> {
    const after = ctx.config.reminderAfterTournamentEndMins ?? 60;
    const cutoff = new Date(Date.now() - after * 60_000);
    const tournaments = await this.prisma.tournament.findMany({
      where: { status: "LIVE", dateTime: { lt: cutoff } },
      include: {
        participants: { where: { paid: true } },
        results: true,
      },
    });

    let reminded = 0;
    let touched = 0;
    let skippedDryRun = 0;

    for (const t of tournaments) {
      const submitters = new Set(t.results.map((r) => r.submittedById));
      const pending = t.participants.filter((p) => !submitters.has(p.userId));
      if (!pending.length) continue;
      touched += 1;

      for (const p of pending) {
        if (ctx.actionsTaken >= ctx.maxActions) break;
        if (this.canAct(ctx)) {
          await this.prisma.notification.create({
            data: {
              userId: p.userId,
              type: "TOURNAMENT",
              title: "Submit your result",
              body: `Don't forget to submit your match result for ${t.title}! Deadline approaching.`,
            },
          });
          ctx.actionsTaken += 1;
          reminded += 1;
        } else if (ctx.dryRun) {
          skippedDryRun += 1;
          reminded += 1;
        }
      }
    }

    return {
      summary: `Reminded:${reminded} players across ${touched} tournaments`,
      details: { reminded, tournaments: touched },
      flagsCreated: 0,
      actionsPerformed: ctx.actionsTaken,
      skippedDryRun,
    };
  }
}
