import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { SystemConfigService } from "../admin/system-config.service";

export interface DistributeResult {
  userId: string;
  kills: number;
  gotBooyah: boolean;
}

export interface PrizeStructureV2 {
  entryFee: number;
  maxPlayers: number;
  actualPlayers: number;
  grossPool: number;
  platformCut: number;
  netPool: number;
  killPool: number;
  perKillReward: number;
  booyahPrize: number;
  systemFeePercent: number;
  killRewardPercent: number;
  booyahNote: string;
  platformNote: string;
  scalingNote: string;
  exampleEarning: string;
  isWinnerTakesAll?: boolean;
  prizePerWinner?: number;
}

@Injectable()
export class PrizeService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private config: SystemConfigService,
  ) {}

  // ---- Free daily eligibility (kept for FREE_DAILY type) ----
  async checkFreeDailyEligibility(userId: string) {
    const cooldownHours = this.config.getNumber("FREE_DAILY_COOLDOWN_HOURS");
    const since = new Date(Date.now() - cooldownHours * 3_600_000);
    const last = await this.prisma.freeDailySlot.findFirst({
      where: { userId, usedAt: { gte: since } },
      orderBy: { usedAt: "desc" },
    });
    if (!last) return { eligible: true, nextAvailableAt: null };
    const next = new Date(last.usedAt.getTime() + cooldownHours * 3_600_000);
    return { eligible: false, nextAvailableAt: next.toISOString() };
  }

  async recordFreeDailyUse(userId: string, tournamentId: string) {
    return this.prisma.freeDailySlot.create({ data: { userId, tournamentId } });
  }

  // ---- Core math (Nepali Adda model) ----
  calculateNetPool(entryFee: number, playerCount: number): { gross: number; cut: number; net: number } {
    const sysFee = this.config.getNumber("SYSTEM_FEE_PERCENT");
    const gross = Math.max(0, entryFee * playerCount);
    const cut = Math.floor((gross * sysFee) / 100);
    return { gross, cut, net: gross - cut };
  }

  calculatePerKillReward(entryFee: number, playerCount: number, mode?: string): number {
    if (playerCount <= 0 || entryFee <= 0) return 0;
    
    // As per user request: "if user joins a game of 15, then per kill 12 rs, (profit to system rs 3)"
    // This translates to killReward = entryFee - systemProfit.
    const sysFee = this.config.getNumber("SYSTEM_FEE_PERCENT") || 20;
    
    // We base the kill pool strictly on the requested margin 
    const basePerKill = Math.floor(entryFee * (1 - sysFee / 100)); // entry 15 -> 12

    // In Battle Royale (BR), the total number of kills across all players is always strictly 
    // less than the lobby size (playerCount - 1). Therefore, dividing the kill pool 1:1 
    // is safe and guarantees system profit.
    // However, in Clash Squad (CS) and Lone Wolf (LW), players respawn, so average rounds must be considered
    // to prevent going negative! 
    let avgExpectedKills = 1.0; 
    
    if (mode?.startsWith("CS_")) {
      avgExpectedKills = 3.5; // average kills per player in a 7 round match
    } else if (mode?.startsWith("LW_")) {
      avgExpectedKills = 2.5; 
    } 

    const perKill = Math.floor(basePerKill / avgExpectedKills);
    return Math.max(perKill, 1);
  }

  calculateBooyahPrize(actualPlayers: number): number {
    if (actualPlayers <= 0) return 0;
    const perPlayer = this.config.getNumber("BOOYAH_COINS_PER_PLAYER");
    return actualPlayers * perPlayer;
  }

  /**
   * Determines if a tournament uses winner-takes-all prize model (CS/LW modes).
   * In these modes, the entire pool (minus platform fee) goes to the winning team,
   * and entry fees are per team (not per player).
   */
  isWinnerTakesAllMode(mode?: string): boolean {
    if (!mode) return false;
    return mode === "CS_4V4" || mode === "LW_1V1" || mode === "LW_2V2";
  }

  /**
   * For winner-takes-all modes (CS/LW), the entire net pool goes to the
   * winning team's captain (the player who registered and paid for the team).
   * Formula: (entryFee × actualTeams) - platformFee%
   * Example: 2 teams × Rs 50 = 100 → 10% fee = Rs 10 → captain gets Rs 90
   */
  calculateWinnerTakesAllPrize(
    entryFeePerTeam: number,
    actualTeamsJoined: number,
  ): number {
    if (actualTeamsJoined <= 0) return 0;
    const sysFee = this.config.getNumber("SYSTEM_FEE_PERCENT");
    const gross = entryFeePerTeam * actualTeamsJoined;
    const cut = Math.floor((gross * sysFee) / 100);
    return gross - cut;
  }

  calculatePrizeStructure(
    tournament: { entryFeeNpr: number; maxSlots: number; type?: string; mode?: string },
    actualPlayers: number,
  ): PrizeStructureV2 {
    const entryFee = tournament.entryFeeNpr;
    const maxPlayers = tournament.maxSlots;
    const sysFee = this.config.getNumber("SYSTEM_FEE_PERCENT");

    // FIX: Use maxPlayers for preview when actualPlayers is 0
    // Only use actualPlayers for final payout after room is locked
    const playerCount = actualPlayers > 0 ? actualPlayers : maxPlayers;

    // Check if this is a winner-takes-all mode (CS/LW)
    if (this.isWinnerTakesAllMode(tournament.mode)) {
      let teamSize = 4;
      if (tournament.mode === "LW_1V1") teamSize = 1;
      else if (tournament.mode === "LW_2V2") teamSize = 2;

      const teamsJoined = Math.max(1, Math.floor(playerCount / teamSize));
      const gross = entryFee * teamsJoined;
      const cut = Math.floor((gross * sysFee) / 100);
      const net = gross - cut;

      return {
        entryFee,
        maxPlayers,
        actualPlayers: playerCount,
        grossPool: gross,
        platformCut: cut,
        netPool: net,
        killPool: 0,
        perKillReward: 0,
        booyahPrize: 0,
        systemFeePercent: sysFee,
        killRewardPercent: 0,
        booyahNote: "",
        platformNote: `Rs ${cut} platform fee (${sysFee}%)`,
        scalingNote: `${teamsJoined} teams × Rs${entryFee}/team = Rs${gross} total`,
        exampleEarning: `Winning captain gets Rs ${net}`,
        isWinnerTakesAll: true,
        prizePerWinner: net,
      };
    }

    // For BR/solo modes: standard per-kill model
    const players = Math.max(1, playerCount);
    const killPct = this.config.getNumber("KILL_REWARD_PERCENT");

    const { gross, cut, net } = this.calculateNetPool(entryFee, players);
    const killPool = Math.floor((net * killPct) / 100);
    const perKillReward = this.calculatePerKillReward(entryFee, players, tournament.mode);
    const booyahPrize = this.calculateBooyahPrize(players);

    return {
      entryFee,
      maxPlayers,
      actualPlayers: players,
      grossPool: gross,
      platformCut: cut,
      netPool: net,
      killPool,
      perKillReward,
      booyahPrize,
      systemFeePercent: sysFee,
      killRewardPercent: killPct,
      booyahNote: `Rs ${booyahPrize} for Booyah (${players} players × Rs ${this.config.getNumber(
        "BOOYAH_COINS_PER_PLAYER",
      )})`,
      platformNote: `Rs ${cut} platform fee (${sysFee}%)`,
      scalingNote:
        actualPlayers > 0 && actualPlayers < maxPlayers
          ? `Pool scaled to ${actualPlayers}/${maxPlayers} players`
          : `Estimated for full lobby (${maxPlayers} players)`,
      exampleEarning: `3 kills + Booyah = Rs ${3 * perKillReward + booyahPrize}`,
      isWinnerTakesAll: false,
    };
  }

  // ---- Lock + finalize ----
  async lockRoomAndFinalizePrizes(tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { where: { paid: true } } },
    });
    if (!t) throw new NotFoundException();
    if (t.roomLocked) throw new BadRequestException("Room already locked");

    const actualPlayers = t.participants.length;
    const minPlayers = this.config.getNumber("MIN_PLAYERS_TO_START");
    if (actualPlayers < minPlayers)
      throw new BadRequestException(
        `Need ${minPlayers} paid players to start (currently ${actualPlayers})`,
      );

    const structure = this.calculatePrizeStructure(
      { entryFeeNpr: t.entryFeeNpr, maxSlots: t.maxSlots, type: t.type, mode: t.mode },
      actualPlayers,
    );

    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        roomLocked: true,
        roomLockedAt: new Date(),
        actualPlayers,
        perKillReward: structure.perKillReward,
        booyahPrize: structure.booyahPrize,
        booyahPrizeNote: structure.booyahNote,
        prizeStructure: structure as any,
        killPrize: structure.perKillReward,
        perKillPrizeNpr: structure.perKillReward,
      },
    });

    // Notify participants with appropriate message based on prize model
    const notificationBody = structure.isWinnerTakesAll
      ? `${actualPlayers} players confirmed. Winning captain takes Rs ${structure.prizePerWinner}.`
      : `${actualPlayers} players confirmed. Per kill: Rs ${structure.perKillReward}, Booyah: Rs ${structure.booyahPrize}.`;

    for (const p of t.participants) {
      await this.prisma.notification.create({
        data: {
          userId: p.userId,
          type: "TOURNAMENT",
          title: `${t.title} — Room locked`,
          body: notificationBody,
        },
      });
    }
    return updated;
  }

  // ---- Distribute prizes ----
  async distributePrizes(tournamentId: string, results: DistributeResult[]) {
    return this.prisma.$transaction(async (tx: any) => {
      const t = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: { where: { paid: true } } },
      });
      if (!t) throw new NotFoundException();

      const credits: { userId: string; amount: number; note: string }[] = [];

      // Winner-takes-all modes: entire net pool goes to winning team's captain
      if (this.isWinnerTakesAllMode(t.mode)) {
        const structure = t.prizeStructure as any;
        const netPool = structure?.netPool ?? 0;
        if (netPool <= 0) return { ok: true, credits };

        // Find the winner — gotBooyah marks the winning team's captain
        const winner = results.find((r) => r.gotBooyah);
        if (!winner) return { ok: true, credits };

        const note = `Match ${t.id} — Winner takes all: Rs${netPool}`;
        credits.push({ userId: winner.userId, amount: netPool, note });

        await tx.botRollback.create({
          data: {
            jobName: "MANUAL_PRIZE",
            jobLogId: t.id,
            action: "REFUND",
            targetType: "USER",
            targetId: winner.userId,
            beforeState: { userId: winner.userId, refundAmount: netPool } as any,
            afterState: { userId: winner.userId, refundAmount: netPool } as any,
          },
        });

        const wallet = await tx.wallet.upsert({
          where: { userId: winner.userId },
          create: { userId: winner.userId, balanceNpr: netPool },
          update: { balanceNpr: { increment: netPool } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "CREDIT",
            reason: "PRIZE",
            amountNpr: netPool,
            note,
          },
        });
        await tx.tournamentParticipant.updateMany({
          where: { tournamentId, userId: winner.userId },
          data: { prizeEarned: netPool, placement: 1 },
        });
        await tx.notification.create({
          data: {
            userId: winner.userId,
            type: "WALLET",
            title: `Prize: Rs ${netPool}`,
            body: note,
          },
        });

        await tx.tournament.update({
          where: { id: tournamentId },
          data: { status: "COMPLETED" },
        });
        return { ok: true, credits };
      }

      // BR / per-kill model
      const perKill = t.perKillReward ?? 0;
      const booyah = t.booyahPrize ?? 0;

      for (const r of results) {
        const earning =
          (r.kills ?? 0) * perKill + (r.gotBooyah ? booyah : 0);
        if (earning <= 0) continue;
        const note = `Match ${t.id} — ${r.kills} kills × Rs${perKill}${
          r.gotBooyah ? ` + Booyah Rs${booyah}` : ""
        }`;
        credits.push({ userId: r.userId, amount: earning, note });

        // Snapshot before crediting (rollback support)
        await tx.botRollback.create({
          data: {
            jobName: "MANUAL_PRIZE",
            jobLogId: t.id,
            action: "REFUND",
            targetType: "USER",
            targetId: r.userId,
            beforeState: { userId: r.userId, refundAmount: earning } as any,
            afterState: { userId: r.userId, refundAmount: earning } as any,
          },
        });

        const wallet = await tx.wallet.upsert({
          where: { userId: r.userId },
          create: { userId: r.userId, balanceNpr: earning },
          update: { balanceNpr: { increment: earning } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "CREDIT",
            reason: "PRIZE",
            amountNpr: earning,
            note,
          },
        });
        await tx.tournamentParticipant.updateMany({
          where: { tournamentId, userId: r.userId },
          data: { prizeEarned: earning, placement: r.gotBooyah ? 1 : null },
        });
        await tx.notification.create({
          data: {
            userId: r.userId,
            type: "WALLET",
            title: `Prize: Rs ${earning}`,
            body: note,
          },
        });
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "COMPLETED" },
      });
      return { ok: true, credits };
    });
  }
}
