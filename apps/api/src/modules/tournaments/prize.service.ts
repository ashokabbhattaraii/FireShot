import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { SystemConfigService } from "../admin/system-config.service";

export interface DistributeResult {
  userId: string;
  placement?: number;
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
  prizeBreakdown?: { rank: string; placement?: number; amount: number; percent: number }[];
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
  isWinnerTakesAllMode(mode?: string, type?: string): boolean {
    if (type === "SOLO_1ST") return true;
    if (!mode) return false;
    return mode === "CS_4V4" || mode === "LW_1V1" || mode === "LW_2V2";
  }

  private rankSplits(type?: string): { rank: string; placement: number; percent: number }[] {
    if (type === "SOLO_TOP3") {
      return [
        { rank: "1st Place", placement: 1, percent: 50 },
        { rank: "2nd Place", placement: 2, percent: 30 },
        { rank: "3rd Place", placement: 3, percent: 20 },
      ];
    }
    if (type === "SQUAD_TOP10") {
      return [25, 18, 12, 8, 8, 3, 3, 3, 3, 3].map((percent, i) => ({
        rank: `#${i + 1}`,
        placement: i + 1,
        percent,
      }));
    }
    if (type === "COMBO") {
      return [
        { rank: "1st Place", placement: 1, percent: 30 },
        { rank: "2nd Place", placement: 2, percent: 18 },
        { rank: "3rd Place", placement: 3, percent: 12 },
      ];
    }
    return [];
  }

  private buildPrizeBreakdown(
    netPool: number,
    type?: string,
  ): { rank: string; placement?: number; amount: number; percent: number }[] {
    if (type === "SOLO_1ST") {
      return [{ rank: "1st Place", placement: 1, amount: netPool, percent: 100 }];
    }
    return this.rankSplits(type)
      .map((split) => ({
        ...split,
        amount: Math.floor((netPool * split.percent) / 100),
      }))
      .filter((split) => split.amount > 0);
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

    // Check if this is a winner-takes-all tournament.
    if (this.isWinnerTakesAllMode(tournament.mode, tournament.type)) {
      let teamSize = 4;
      if (tournament.mode === "LW_1V1") teamSize = 1;
      else if (tournament.mode === "LW_2V2") teamSize = 2;

      const teamEntryMode = tournament.mode === "CS_4V4" || tournament.mode === "LW_1V1" || tournament.mode === "LW_2V2";
      const teamsJoined = Math.max(1, Math.floor(playerCount / teamSize));
      const paidEntries = teamEntryMode ? teamsJoined : playerCount;
      const gross = entryFee * paidEntries;
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
        scalingNote: teamEntryMode
          ? `${teamsJoined} teams × Rs${entryFee}/team = Rs${gross} total`
          : `${playerCount} players × Rs${entryFee} = Rs${gross} total`,
        exampleEarning: `1st place wins Rs ${net}`,
        isWinnerTakesAll: true,
        prizePerWinner: net,
        prizeBreakdown: [{ rank: "1st Place", placement: 1, amount: net, percent: 100 }],
      };
    }

    // For BR/solo modes: standard per-kill model
    const players = Math.max(1, playerCount);
    const killPct = this.config.getNumber("KILL_REWARD_PERCENT");

    const { gross, cut, net } = this.calculateNetPool(entryFee, players);
    const placementOnly = tournament.type === "SOLO_TOP3" || tournament.type === "SQUAD_TOP10";
    const killPool = placementOnly ? 0 : Math.floor((net * killPct) / 100);
    const perKillReward = placementOnly ? 0 : this.calculatePerKillReward(entryFee, players, tournament.mode);
    const booyahPrize = placementOnly ? 0 : this.calculateBooyahPrize(players);
    const prizeBreakdown = this.buildPrizeBreakdown(net, tournament.type);

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
      exampleEarning: placementOnly
        ? `${prizeBreakdown[0]?.rank ?? "Winner"} gets Rs ${prizeBreakdown[0]?.amount ?? net}`
        : `3 kills + Booyah = Rs ${3 * perKillReward + booyahPrize}`,
      isWinnerTakesAll: false,
      prizeBreakdown,
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
      : structure.prizeBreakdown?.length
        ? `${actualPlayers} players confirmed. Top prize: Rs ${structure.prizeBreakdown[0].amount}.`
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
      const officialResults = results;

      // Tournaments are admin/system managed. Replace any legacy player-submitted
      // rows with the official admin-published scoreboard.
      await tx.matchResult.deleteMany({ where: { tournamentId } });
      for (const r of officialResults) {
        await tx.matchResult.create({
          data: {
            tournamentId,
            submittedById: r.userId,
            placement: r.placement ?? null,
            kills: r.kills ?? 0,
            note: "Official admin result",
            screenshotUrl: "",
            verified: true,
          },
        });
        await tx.tournamentParticipant.updateMany({
          where: { tournamentId, userId: r.userId },
          data: { placement: r.placement ?? null },
        });
      }

      // Winner-takes-all modes: entire net pool goes to winning team's captain
      if (this.isWinnerTakesAllMode(t.mode, t.type)) {
        const structure = t.prizeStructure as any;
        const netPool = structure?.netPool ?? 0;
        if (netPool <= 0) return { ok: true, credits };

        // Find the winner — gotBooyah marks the winning team's captain
        const winner = results.find((r) => r.placement === 1 || r.gotBooyah);
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

      // Placement prize models: top 3, top 10, or combo placement pool.
      const structure = t.prizeStructure as any;
      const breakdown = (structure?.prizeBreakdown ?? []) as {
        placement?: number;
        amount: number;
        rank: string;
      }[];
      if (breakdown.length) {
        for (const r of results) {
          const placementPrize = breakdown.find((p) => p.placement === r.placement);
          const placementAmount = placementPrize?.amount ?? 0;
          const comboKillAmount =
            t.type === "COMBO" ? (r.kills ?? 0) * (t.perKillReward ?? 0) : 0;
          const earning = placementAmount + comboKillAmount;
          if (earning <= 0) continue;
          const note = `Match ${t.id} — ${placementPrize?.rank ?? `#${r.placement}`} prize Rs${placementAmount}${
            comboKillAmount ? ` + ${r.kills} kills Rs${comboKillAmount}` : ""
          }`;
          credits.push({ userId: r.userId, amount: earning, note });

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
            data: { walletId: wallet.id, type: "CREDIT", reason: "PRIZE", amountNpr: earning, note },
          });
          await tx.tournamentParticipant.updateMany({
            where: { tournamentId, userId: r.userId },
            data: { prizeEarned: earning, placement: r.placement ?? null },
          });
          await tx.notification.create({
            data: { userId: r.userId, type: "WALLET", title: `Prize: Rs ${earning}`, body: note },
          });
        }

        await tx.tournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED" } });
        return { ok: true, credits };
      }

      // Kill-race model
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
