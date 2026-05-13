import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ChallengGameMode,
  ChallengeStatus,
  DisputeReason,
  PrismaClient,
} from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { SystemConfigService } from "../admin/system-config.service";
import { RealtimeService } from "../../common/realtime/realtime.service";
import { MemoryCacheService } from "../../common/cache/memory-cache.service";
import { ProfileService } from "../profile/profile.service";

const CHALLENGE_LIST_CACHE_PREFIX = "challenges:list:";
const CHALLENGE_DETAIL_CACHE_PREFIX = "challenges:detail:";
const CHALLENGE_LIST_SOFT_TTL_SECONDS = 15;
const CHALLENGE_LIST_HARD_TTL_SECONDS = 120;
const CHALLENGE_DETAIL_SOFT_TTL_SECONDS = 10;
const CHALLENGE_DETAIL_HARD_TTL_SECONDS = 90;
const CS_TEAM_MODES = ["1v1", "2v2", "3v3", "4v4"];
const CS_COINS = ["DEFAULT", "9980"];
const CS_WEAPONS = [
  "NONE", "MP40", "UMP", "MP5", "BIZON", "VECTOR", "M1014", "M1887",
  "MAG7", "M590", "AWM", "XM8", "D-EAGLE", "WOODPECKER",
];
const CS_ARMOURS = [
  "NONE", "VEST_LV2", "VEST_LV3", "VEST_LV4", "HELMET_LV2", "HELMET_LV3",
];
const BR_MAPS = ["BERMUDA", "KALAHARI", "PURGATORY", "NEXTERRA"];
const BR_TEAM_MODES = ["SOLO", "DUO", "SQUAD"];
const BR_WIN_CONDITIONS = [
  "KILLS", "BOOYAH", "HEADSHOTS_ONLY", "MOST_DAMAGE", "SURVIVAL_TIME", "FIRST_TO_N_KILLS",
];
const LW_TEAM_MODES = ["1v1", "2v2"];

const PLAYER_SELECT = {
  id: true,
  name: true,
  email: true,
  profile: {
    select: {
      ign: true,
      level: true,
      avatarUrl: true,
    },
  },
} as const;

const CHALLENGE_LIST_SELECT = {
  id: true,
  challengeNumber: true,
  creatorId: true,
  opponentId: true,
  title: true,
  gameMode: true,
  entryFee: true,
  prizeToWinner: true,
  platformFee: true,
  status: true,
  brMap: true,
  brTeamMode: true,
  brWinCondition: true,
  brTargetKills: true,
  brBannedGuns: true,
  brHeadshotOnly: true,
  csTeamMode: true,
  csRounds: true,
  csCoins: true,
  csThrowable: true,
  csLoadout: true,
  csCompulsoryWeapon: true,
  csCompulsoryArmour: true,
  lwTeamMode: true,
  characterSkill: true,
  gunAttribute: true,
  headshotOnly: true,
  noEmulator: true,
  minLevel: true,
  maxHeadshotRate: true,
  povRequired: true,
  screenshotRequired: true,
  reportWindowMins: true,
  scheduledAt: true,
  startedAt: true,
  endedAt: true,
  winnerId: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: PLAYER_SELECT },
} as const;

const CHALLENGE_DETAIL_SELECT = {
  ...CHALLENGE_LIST_SELECT,
  roomId: true,
  roomPassword: true,
  matchedAt: true,
  roomDeadline: true,
  disputeId: true,
  opponent: { select: PLAYER_SELECT },
  results: true,
} as const;

export interface CreateChallengeDto {
  title: string;
  gameMode: ChallengGameMode;
  entryFee: number;
  isPrivate?: boolean;
  scheduledAt?: string;
  brMap?: string;
  brTeamMode?: string;
  brWinCondition?: string;
  brTargetKills?: number;
  brBannedGuns?: string[];
  brHeadshotOnly?: boolean;
  csTeamMode?: string;
  csRounds?: number;
  csCoins?: string;
  csThrowable?: boolean;
  csLoadout?: boolean;
  csCompulsoryWeapon?: string;
  csCompulsoryArmour?: string;
  lwTeamMode?: string;
  characterSkill?: boolean;
  gunAttribute?: boolean;
  headshotOnly?: boolean;
  noEmulator?: boolean;
  minLevel?: number;
  maxHeadshotRate?: number;
  povRequired?: boolean;
  screenshotRequired?: boolean;
  reportWindowMins?: number;
}

@Injectable()
export class ChallengesService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private config: SystemConfigService,
    private realtime: RealtimeService,
    private cache: MemoryCacheService,
    private profiles: ProfileService,
  ) {}

  getChallengeRulesText(c: any): string {
    const lines: string[] = [];
    if (c.gameMode === "CS") {
      lines.push(`Team Mode: ${c.csTeamMode ?? "—"} | Rounds: ${c.csRounds} | Coins: ${c.csCoins}`);
      lines.push(
        `Throwable: ${c.csThrowable ? "Yes" : "No"} | Character Skill: ${c.characterSkill ? "Yes" : "No"} | Gun Attribute: ${c.gunAttribute ? "Yes" : "No"}`,
      );
      lines.push(
        `Headshot Only: ${c.headshotOnly ? "Yes" : "No"} | Loadout: ${c.csLoadout ? "Yes" : "No"}`,
      );
      if (c.csCompulsoryWeapon && c.csCompulsoryWeapon !== "NONE")
        lines.push(`Compulsory Weapon: ${c.csCompulsoryWeapon}`);
      if (c.csCompulsoryArmour && c.csCompulsoryArmour !== "NONE")
        lines.push(`Compulsory Armour: ${c.csCompulsoryArmour}`);
    } else if (c.gameMode === "LW") {
      lines.push(`Mode: Lone Wolf | Team: ${c.lwTeamMode ?? "—"}`);
      lines.push(`Headshot Only: ${c.headshotOnly ? "Yes" : "No"}`);
    } else {
      lines.push(
        `Map: ${c.brMap ?? "—"} | Mode: ${c.brTeamMode ?? "—"} | Win: ${c.brWinCondition ?? "—"}`,
      );
      if (c.brWinCondition === "FIRST_TO_N_KILLS" && c.brTargetKills)
        lines.push(`Target: First to ${c.brTargetKills} kills`);
      if (c.brBannedGuns?.length) lines.push(`Banned Guns: ${c.brBannedGuns.join(", ")}`);
      if (c.brHeadshotOnly) lines.push("HEADSHOT ONLY MODE");
    }

    lines.push("—");
    if (c.noEmulator) lines.push("No emulator allowed");
    if (c.povRequired) lines.push("POV recording mandatory");
    if (c.screenshotRequired) lines.push("Screenshot required for result submission");
    lines.push(`Disputes must be raised within ${c.reportWindowMins} minutes`);
    lines.push("Hacker proof + recording = auto disqualification of hacker");
    if (c.minLevel > 0) lines.push(`Minimum Level: ${c.minLevel}`);
    if (c.maxHeadshotRate < 100) lines.push(`Max Headshot Rate: ${c.maxHeadshotRate}%`);

    return lines.join("\n");
  }

  async createChallenge(creatorId: string, dto: CreateChallengeDto) {
    const max = this.config.getNumber("MAX_ENTRY_FEE");
    const min = this.config.getNumber("MIN_ENTRY_FEE");
    if (dto.entryFee < min || dto.entryFee > max)
      throw new BadRequestException(`Entry fee must be Rs ${min}–${max}`);

    if (dto.gameMode === "BR") {
      throw new BadRequestException(
        "Battle Royale challenges are disabled. Use Clash Squad or Lone Wolf. Battle Royale remains available in tournaments.",
      );
    }

    if (dto.gameMode === "CS") {
      if (!dto.csTeamMode || !CS_TEAM_MODES.includes(dto.csTeamMode))
        throw new BadRequestException("csTeamMode required: 1v1/2v2/3v3/4v4");
      if (![7, 13].includes(dto.csRounds ?? 7))
        throw new BadRequestException("csRounds must be 7 or 13");
      if (!CS_COINS.includes(dto.csCoins ?? "DEFAULT"))
        throw new BadRequestException("csCoins must be DEFAULT or 9980");
      if (dto.csCompulsoryWeapon && !CS_WEAPONS.includes(dto.csCompulsoryWeapon))
        throw new BadRequestException("Invalid csCompulsoryWeapon");
      if (dto.csCompulsoryArmour && !CS_ARMOURS.includes(dto.csCompulsoryArmour))
        throw new BadRequestException("Invalid csCompulsoryArmour");
    } else if (dto.gameMode === "LW") {
      if (!dto.lwTeamMode || !LW_TEAM_MODES.includes(dto.lwTeamMode))
        throw new BadRequestException("lwTeamMode required: 1v1/2v2");
    } else {
      if (!dto.brMap || !BR_MAPS.includes(dto.brMap))
        throw new BadRequestException("brMap required");
      if (!dto.brTeamMode || !BR_TEAM_MODES.includes(dto.brTeamMode))
        throw new BadRequestException("brTeamMode required");
      if (!dto.brWinCondition || !BR_WIN_CONDITIONS.includes(dto.brWinCondition))
        throw new BadRequestException("brWinCondition required");
      if (dto.brWinCondition === "FIRST_TO_N_KILLS" && !dto.brTargetKills)
        throw new BadRequestException("Target kills required for FIRST_TO_N_KILLS");
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId: creatorId } });
    if (!wallet || wallet.balanceNpr < dto.entryFee)
      throw new BadRequestException("Insufficient wallet balance");

    const totalPool = dto.entryFee * 2;
    const feePercent = this.config.getNumber("CHALLENGE_FEE_PERCENT") / 100;
    const platformFee = Math.floor(totalPool * feePercent);
    const prizeToWinner = totalPool - platformFee;

    const count = await this.prisma.challenge.count();
    const challengeNumber = `CH-${String(count + 1).padStart(4, "0")}`;
    const inviteCode = dto.isPrivate ? this.randomCode(8) : null;

    const created = await this.prisma.$transaction(async (tx: any) => {
      await tx.botRollback.create({
        data: {
          jobName: "MANUAL_CHALLENGE",
          jobLogId: challengeNumber,
          action: "REFUND",
          targetType: "USER",
          targetId: creatorId,
          beforeState: { userId: creatorId, refundAmount: dto.entryFee, balance: wallet.balanceNpr },
          afterState: { userId: creatorId, refundAmount: dto.entryFee, balance: wallet.balanceNpr - dto.entryFee },
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceNpr: { decrement: dto.entryFee } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          reason: "ENTRY_FEE",
          amountNpr: dto.entryFee,
          note: `Challenge ${challengeNumber} entry`,
        },
      });

      return tx.challenge.create({
        data: {
          challengeNumber,
          creatorId,
          title: dto.title,
          gameMode: dto.gameMode,
          entryFee: dto.entryFee,
          prizeToWinner,
          platformFee,
          isPrivate: !!dto.isPrivate,
          inviteCode,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          brMap: dto.brMap,
          brTeamMode: dto.brTeamMode,
          brWinCondition: dto.brWinCondition,
          brTargetKills: dto.brTargetKills,
          brBannedGuns: dto.brBannedGuns ?? [],
          brHeadshotOnly: !!dto.brHeadshotOnly,
          csTeamMode: dto.csTeamMode,
          csRounds: dto.csRounds ?? 7,
          csCoins: dto.csCoins ?? "DEFAULT",
          csThrowable: dto.csThrowable ?? true,
          csLoadout: dto.csLoadout ?? false,
          csCompulsoryWeapon: dto.csCompulsoryWeapon,
          csCompulsoryArmour: dto.csCompulsoryArmour,
          lwTeamMode: dto.lwTeamMode,
          characterSkill: dto.characterSkill ?? true,
          gunAttribute: dto.gunAttribute ?? false,
          headshotOnly: dto.headshotOnly ?? false,
          noEmulator: dto.noEmulator ?? true,
          minLevel: dto.minLevel ?? 0,
          maxHeadshotRate: dto.maxHeadshotRate ?? 100,
          povRequired: dto.povRequired ?? true,
          screenshotRequired: dto.screenshotRequired ?? true,
          reportWindowMins: dto.reportWindowMins ?? 60,
        },
      });
    });
    this.invalidateChallengeCaches(created.id);
    return created;
  }

  async list(filters: { gameMode?: ChallengGameMode; status?: ChallengeStatus; limit?: number }) {
    return this.cache.getStaleWhileRevalidate(
      this.listCacheKey(filters),
      CHALLENGE_LIST_SOFT_TTL_SECONDS,
      CHALLENGE_LIST_HARD_TTL_SECONDS,
      () => this.loadChallengeList(filters),
    );
  }

  private async loadChallengeList(filters: {
    gameMode?: ChallengGameMode;
    status?: ChallengeStatus;
    limit?: number;
  }) {
    const where: any = { isPrivate: false };
    if (filters.gameMode) where.gameMode = filters.gameMode;
    else where.gameMode = { in: ["CS", "LW"] };
    if (filters.status) where.status = filters.status;
    else where.status = "OPEN";
    const items = await this.prisma.challenge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: CHALLENGE_LIST_SELECT,
      take: this.normalizeListLimit(filters.limit),
    });
    return items.map((c) => ({ ...c, rulesText: this.getChallengeRulesText(c) }));
  }

  async myChallenges(userId: string) {
    return this.prisma.challenge.findMany({
      where: { OR: [{ creatorId: userId }, { opponentId: userId }] },
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, profile: true } },
        opponent: { select: { id: true, name: true, profile: true } },
      },
    });
  }

  async getById(id: string) {
    const c = await this.cache.getStaleWhileRevalidate(
      this.detailCacheKey(id),
      CHALLENGE_DETAIL_SOFT_TTL_SECONDS,
      CHALLENGE_DETAIL_HARD_TTL_SECONDS,
      () => this.loadChallengeDetail(id),
    );
    if (!c) throw new NotFoundException();
    return { ...c, rulesText: this.getChallengeRulesText(c) };
  }

  private loadChallengeDetail(id: string) {
    return this.prisma.challenge.findUnique({
      where: { id },
      select: CHALLENGE_DETAIL_SELECT,
    });
  }

  async getByInviteCode(code: string) {
    const c = await this.prisma.challenge.findUnique({ where: { inviteCode: code } });
    if (!c) throw new NotFoundException();
    return { ...c, rulesText: this.getChallengeRulesText(c) };
  }

  async joinChallenge(userId: string, challengeId: string, inviteCode?: string) {
    const c = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!c) throw new NotFoundException();
    if (c.creatorId === userId)
      throw new BadRequestException("You cannot join your own challenge");
    if (c.opponentId)
      throw new BadRequestException("Challenge already taken");
    if (c.status !== "OPEN")
      throw new BadRequestException("Challenge is not open");
    if (c.isPrivate && c.inviteCode !== inviteCode)
      throw new ForbiddenException("Invalid invite code");

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.isBanned) throw new ForbiddenException("Account banned");
    if (user.profile?.freeFireUid) {
      await this.profiles.assertFreeFireUidAllowed(user.profile.freeFireUid);
    }
    if (user.profile?.isBlacklisted)
      throw new ForbiddenException(user.profile.blacklistReason ?? "Blacklisted");
    if (c.minLevel > 0 && (user.profile?.level ?? 0) < c.minLevel)
      throw new ForbiddenException(`Need Level ${c.minLevel}+`);
    if (
      user.profile?.headshotRate != null &&
      user.profile.headshotRate > c.maxHeadshotRate
    )
      throw new ForbiddenException(`Headshot rate too high (max ${c.maxHeadshotRate}%)`);
    if (c.noEmulator && user.profile?.isEmulator)
      throw new ForbiddenException("Emulator players not allowed");

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceNpr < c.entryFee)
      throw new BadRequestException("Insufficient wallet balance");

    const updated = await this.prisma.$transaction(async (tx: any) => {
      const claimed = await tx.challenge.updateMany({
        where: {
          id: challengeId,
          opponentId: null,
          status: "OPEN",
          ...(c.isPrivate ? { inviteCode } : {}),
        },
        data: {
          opponentId: userId,
          status: "MATCHED",
          matchedAt: new Date(),
          roomDeadline: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException("Challenge already taken");
      }

      const debited = await tx.wallet.updateMany({
        where: { id: wallet.id, balanceNpr: { gte: c.entryFee } },
        data: { balanceNpr: { decrement: c.entryFee } },
      });
      if (debited.count !== 1) {
        throw new BadRequestException("Insufficient wallet balance");
      }

      const matched = await tx.challenge.findUnique({
        where: { id: challengeId },
        select: { matchedAt: true, roomDeadline: true },
      });
      const matchedAt = matched?.matchedAt ?? new Date();
      const roomDeadline = matched?.roomDeadline ?? new Date(matchedAt.getTime() + 10 * 60 * 1000);

      await tx.botRollback.create({
        data: {
          jobName: "MANUAL_CHALLENGE",
          jobLogId: c.challengeNumber,
          action: "REFUND",
          targetType: "USER",
          targetId: userId,
          beforeState: { userId, refundAmount: c.entryFee, balance: wallet.balanceNpr },
          afterState: { userId, refundAmount: c.entryFee, balance: wallet.balanceNpr - c.entryFee },
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          reason: "ENTRY_FEE",
          amountNpr: c.entryFee,
          note: `Challenge ${c.challengeNumber} join`,
        },
      });
      const updated = await tx.challenge.findUniqueOrThrow({ where: { id: challengeId } });

      // Notify creator: opponent found, share room within 10 min
      await tx.notification.create({
        data: {
          userId: c.creatorId,
          type: "CHALLENGE",
          title: `Opponent found! ${c.challengeNumber}`,
          body: "Share room ID & password within 10 minutes.",
        },
      });
      // Notify joiner: matched, waiting for room
      await tx.notification.create({
        data: {
          userId,
          type: "CHALLENGE",
          title: `Matched! ${c.challengeNumber}`,
          body: `NPR ${c.entryFee} entry fee deducted. Waiting for room details from creator. Prize: NPR ${c.prizeToWinner}. Platform fee: NPR ${c.platformFee}.`,
        },
      });

      this.realtime.emitToUser(c.creatorId, "challenge_matched", {
        challengeId: c.id,
        challengeNumber: c.challengeNumber,
        roomDeadline: roomDeadline.toISOString(),
      });
      this.realtime.emitToUser(userId, "challenge_matched", {
        challengeId: c.id,
        challengeNumber: c.challengeNumber,
        roomDeadline: roomDeadline.toISOString(),
      });
      this.realtime.emitToUser(userId, "wallet_updated", {});
      return updated;
    });
    this.invalidateChallengeCaches(challengeId);
    return updated;
  }

  async shareRoom(
    challengeId: string,
    userId: string,
    role: string | undefined,
    roomId: string,
    password: string,
  ) {
    const c = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!c) throw new NotFoundException();
    if (c.creatorId !== userId && role !== "ADMIN")
      throw new ForbiddenException("Only creator or admin can share room");
    if (!c.opponentId) throw new BadRequestException("No opponent yet");
    if (c.status !== "MATCHED")
      throw new BadRequestException("Room can only be shared when status is MATCHED");

    // Check deadline (10 min window) — admin can bypass
    if (role !== "ADMIN" && c.roomDeadline && new Date() > c.roomDeadline) {
      throw new BadRequestException("Room sharing deadline expired (10 minutes). Contact support.");
    }

    const updated = await this.prisma.challenge.update({
      where: { id: challengeId },
      data: { roomId, roomPassword: password, status: "ROOM_SHARED", startedAt: new Date() },
    });
    for (const uid of [c.creatorId, c.opponentId]) {
      await this.prisma.notification.create({
        data: {
          userId: uid,
          type: "CHALLENGE",
          title: `${c.challengeNumber} — Room Ready!`,
          body: `Room ID: ${roomId} • Password: ${password}. Join now!`,
        },
      });
      this.realtime.emitToUser(uid, "challenge_room_shared", {
        challengeId: c.id,
        roomId,
        roomPassword: password,
      });
    }
    this.invalidateChallengeCaches(challengeId);
    return updated;
  }

  async submitResult(
    challengeId: string,
    userId: string,
    dto: {
      outcome?: string;
      kills?: number;
      headshots?: number;
      damage?: number;
      survivalTimeSecs?: number;
      gotBooyah?: boolean;
      screenshotUrl?: string;
      povUrl?: string;
    },
  ) {
    const c = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { results: true },
    });
    if (!c) throw new NotFoundException();
    if (c.creatorId !== userId && c.opponentId !== userId)
      throw new ForbiddenException("Not part of this challenge");

    // Enforce result submit delay after room was shared
    if (c.startedAt) {
      const delayMins = this.config.getNumber("RESULT_SUBMIT_DELAY_MINS");
      const earliest = new Date(c.startedAt.getTime() + delayMins * 60_000);
      if (new Date() < earliest) {
        const remainSecs = Math.ceil((earliest.getTime() - Date.now()) / 1000);
        throw new BadRequestException(
          `Result submission opens in ${Math.ceil(remainSecs / 60)} minute(s). Play the match first.`,
        );
      }
    }

    const outcome = dto.outcome?.toUpperCase();
    if (!outcome || !["WIN", "LOSE"].includes(outcome))
      throw new BadRequestException("outcome must be WIN or LOSE");

    // If WIN: require proof
    if (outcome === "WIN") {
      if (c.screenshotRequired && !dto.screenshotUrl)
        throw new BadRequestException("Screenshot is required when claiming win");
      if (c.povRequired && !dto.povUrl)
        throw new BadRequestException("POV recording link is required when claiming win");
    }

    await this.prisma.challengeResult.upsert({
      where: { challengeId_userId: { challengeId, userId } },
      create: {
        challengeId,
        userId,
        outcome,
        kills: dto.kills ?? 0,
        headshots: dto.headshots ?? 0,
        damage: dto.damage ?? 0,
        survivalTimeSecs: dto.survivalTimeSecs ?? 0,
        gotBooyah: !!dto.gotBooyah,
        screenshotUrl: dto.screenshotUrl,
        povUrl: dto.povUrl,
      },
      update: {
        outcome,
        kills: dto.kills ?? 0,
        headshots: dto.headshots ?? 0,
        damage: dto.damage ?? 0,
        survivalTimeSecs: dto.survivalTimeSecs ?? 0,
        gotBooyah: !!dto.gotBooyah,
        screenshotUrl: dto.screenshotUrl,
        povUrl: dto.povUrl,
        submittedAt: new Date(),
      },
    });

    const fresh = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { results: true },
    });
    if (fresh && fresh.results.length === 2) {
      const winnerId = this.determineWinner(fresh);
      if (winnerId) {
        return this.distributeChallengeWinnings(challengeId, winnerId);
      }
      await this.prisma.challenge.update({
        where: { id: challengeId },
        data: { status: "DISPUTED" },
      });
      const dispute = await this.prisma.challengeDispute.create({
        data: {
          challengeId,
          raisedBy: "system",
          reason: "WRONG_RESULT" as DisputeReason,
          description: "Auto-created: results tied and could not be auto-resolved",
        },
      });
      await this.prisma.challenge.update({
        where: { id: challengeId },
        data: { disputeId: dispute.id },
      });
    }
    this.invalidateChallengeCaches(challengeId);
    return { ok: true };
  }

  private determineWinner(c: any): string | null {
    const [a, b] = c.results;
    if (!a || !b) return null;
    const cond = c.gameMode === "CS"
      ? c.headshotOnly ? "HEADSHOTS_ONLY" : "KILLS"
      : c.brWinCondition;

    switch (cond) {
      case "KILLS": {
        if (a.kills !== b.kills) return a.kills > b.kills ? a.userId : b.userId;
        if (a.headshots !== b.headshots) return a.headshots > b.headshots ? a.userId : b.userId;
        return null;
      }
      case "BOOYAH": {
        if (a.gotBooyah !== b.gotBooyah) return a.gotBooyah ? a.userId : b.userId;
        if (a.kills !== b.kills) return a.kills > b.kills ? a.userId : b.userId;
        return null;
      }
      case "HEADSHOTS_ONLY":
        if (a.headshots !== b.headshots) return a.headshots > b.headshots ? a.userId : b.userId;
        return null;
      case "MOST_DAMAGE":
        if (a.damage !== b.damage) return a.damage > b.damage ? a.userId : b.userId;
        return null;
      case "SURVIVAL_TIME":
        if (a.survivalTimeSecs !== b.survivalTimeSecs)
          return a.survivalTimeSecs > b.survivalTimeSecs ? a.userId : b.userId;
        return null;
      case "FIRST_TO_N_KILLS": {
        const target = c.brTargetKills ?? 0;
        const aHit = a.kills >= target;
        const bHit = b.kills >= target;
        if (aHit && !bHit) return a.userId;
        if (bHit && !aHit) return b.userId;
        if (aHit && bHit) return a.submittedAt < b.submittedAt ? a.userId : b.userId;
        return null;
      }
      default:
        return null;
    }
  }

  async distributeChallengeWinnings(challengeId: string, winnerId: string) {
    const updated = await this.prisma.$transaction(async (tx: any) => {
      const c = await tx.challenge.findUnique({ where: { id: challengeId } });
      if (!c) throw new NotFoundException();

      await tx.botRollback.create({
        data: {
          jobName: "MANUAL_CHALLENGE",
          jobLogId: c.challengeNumber,
          action: "REFUND",
          targetType: "USER",
          targetId: winnerId,
          beforeState: { userId: winnerId, refundAmount: c.prizeToWinner },
          afterState: { userId: winnerId, refundAmount: c.prizeToWinner },
        },
      });

      const wallet = await tx.wallet.upsert({
        where: { userId: winnerId },
        create: { userId: winnerId, balanceNpr: c.prizeToWinner },
        update: { balanceNpr: { increment: c.prizeToWinner } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          reason: "PRIZE",
          amountNpr: c.prizeToWinner,
          note: `Challenge ${c.challengeNumber} prize`,
        },
      });
      const updated = await tx.challenge.update({
        where: { id: challengeId },
        data: { winnerId, status: "COMPLETED", endedAt: new Date() },
      });
      const loserId = c.creatorId === winnerId ? c.opponentId : c.creatorId;
      await tx.notification.create({
        data: {
          userId: winnerId,
          type: "CHALLENGE",
          title: `You won ${c.challengeNumber}!`,
          body: `Rs ${c.prizeToWinner} credited to your wallet.`,
        },
      });
      if (loserId) {
        await tx.notification.create({
          data: {
            userId: loserId,
            type: "CHALLENGE",
            title: `Match result: ${c.challengeNumber}`,
            body: "You lost. Better luck next time.",
          },
        });
      }
      return updated;
    });
    this.invalidateChallengeCaches(challengeId);
    return updated;
  }

  async raiseDispute(
    challengeId: string,
    userId: string,
    reason: DisputeReason,
    description: string,
    evidenceUrls: string[],
  ) {
    const c = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!c) throw new NotFoundException();
    if (c.creatorId !== userId && c.opponentId !== userId)
      throw new ForbiddenException("Not part of this challenge");
    if (c.endedAt) {
      const cutoff = c.endedAt.getTime() + c.reportWindowMins * 60_000;
      if (Date.now() > cutoff) throw new BadRequestException("Report window expired");
    }
    const dispute = await this.prisma.challengeDispute.create({
      data: { challengeId, raisedBy: userId, reason, description, evidenceUrls },
    });
    await this.prisma.challenge.update({
      where: { id: challengeId },
      data: { disputeId: dispute.id, status: "DISPUTED" },
    });
    const supportAdmins = await this.prisma.user.findMany({
      where: { roleRef: { name: { in: ["SUPER_ADMIN", "ADMIN", "SUPPORT"] } } },
      select: { id: true },
    });
    for (const a of supportAdmins) {
      await this.prisma.notification.create({
        data: {
          userId: a.id,
          type: "CHALLENGE",
          title: `Dispute on ${c.challengeNumber}`,
          body: description.slice(0, 120),
        },
      });
    }
    this.invalidateChallengeCaches(challengeId);
    return dispute;
  }

  async handleRoomTimeout(challengeId: string) {
    const c = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!c) return;
    if (c.status !== "MATCHED") return;
    if (!c.roomDeadline || new Date() < c.roomDeadline) return;

    // Refund both players and cancel
    const participants = [c.creatorId, c.opponentId].filter(Boolean) as string[];
    await this.prisma.$transaction(async (tx: any) => {
      for (const uid of participants) {
        const w = await tx.wallet.upsert({
          where: { userId: uid },
          create: { userId: uid, balanceNpr: c.entryFee },
          update: { balanceNpr: { increment: c.entryFee } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: w.id,
            type: "CREDIT",
            reason: "REFUND",
            amountNpr: c.entryFee,
            note: `${c.challengeNumber} — room not shared in time, auto-refund`,
          },
        });
      }
      await tx.challenge.update({
        where: { id: challengeId },
        data: { status: "CANCELLED" },
      });
    });

    for (const uid of participants) {
      await this.prisma.notification.create({
        data: {
          userId: uid,
          type: "CHALLENGE",
          title: `${c.challengeNumber} cancelled`,
          body: "Room was not shared within 10 minutes. Entry fee refunded.",
        },
      });
      this.realtime.emitToUser(uid, "challenge_timeout", { challengeId: c.id });
      this.realtime.emitToUser(uid, "wallet_updated", {});
    }
    this.invalidateChallengeCaches(challengeId);
  }

  async cancelChallenge(challengeId: string, userId: string) {
    const c = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!c) throw new NotFoundException();
    if (c.creatorId !== userId) throw new ForbiddenException("Only creator can cancel");
    if (c.status !== "OPEN") throw new BadRequestException("Cannot cancel after match");

    const updated = await this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balanceNpr: c.entryFee },
        update: { balanceNpr: { increment: c.entryFee } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          reason: "REFUND",
          amountNpr: c.entryFee,
          note: `Challenge ${c.challengeNumber} cancelled — refund`,
        },
      });
      return tx.challenge.update({
        where: { id: challengeId },
        data: { status: "CANCELLED" },
      });
    });
    this.invalidateChallengeCaches(challengeId);
    return updated;
  }

  async resolveDispute(
    disputeId: string,
    adminId: string,
    resolution: "CREATOR" | "OPPONENT" | "REFUND",
    note?: string,
  ) {
    const d = await this.prisma.challengeDispute.findUnique({ where: { id: disputeId } });
    if (!d) throw new NotFoundException();
    const c = await this.prisma.challenge.findUnique({ where: { id: d.challengeId } });
    if (!c) throw new NotFoundException();

    if (resolution === "REFUND") {
      for (const uid of [c.creatorId, c.opponentId].filter(Boolean) as string[]) {
        await this.prisma.$transaction(async (tx: any) => {
          const w = await tx.wallet.upsert({
            where: { userId: uid },
            create: { userId: uid, balanceNpr: c.entryFee },
            update: { balanceNpr: { increment: c.entryFee } },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: w.id,
              type: "CREDIT",
              reason: "REFUND",
              amountNpr: c.entryFee,
              note: `Dispute refund — ${c.challengeNumber}`,
            },
          });
        });
      }
      await this.prisma.challenge.update({
        where: { id: c.id },
        data: { status: "CANCELLED" },
      });
    } else {
      const winnerId = resolution === "CREATOR" ? c.creatorId : c.opponentId!;
      await this.distributeChallengeWinnings(c.id, winnerId);
    }

    const updated = await this.prisma.challengeDispute.update({
      where: { id: disputeId },
      data: {
        status:
          resolution === "REFUND"
            ? "REFUNDED"
            : resolution === "CREATOR"
              ? "RESOLVED_CREATOR"
              : "RESOLVED_OPPONENT",
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution: note,
      },
    });
    this.invalidateChallengeCaches(c.id);
    return updated;
  }

  async addDisputeNote(disputeId: string, authorId: string, authorRole: string, message: string) {
    const d = await this.prisma.challengeDispute.findUnique({ where: { id: disputeId } });
    if (!d) throw new NotFoundException("Dispute not found");
    return this.prisma.disputeNote.create({
      data: { disputeId, authorId, authorRole, message },
    });
  }

  async getDisputeNotes(disputeId: string) {
    return this.prisma.disputeNote.findMany({
      where: { disputeId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getDisputeDetail(disputeId: string) {
    const d = await this.prisma.challengeDispute.findUnique({
      where: { id: disputeId },
      include: { notes: { orderBy: { createdAt: "asc" } } },
    });
    if (!d) throw new NotFoundException();
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: d.challengeId },
      include: {
        creator: { select: PLAYER_SELECT },
        opponent: { select: PLAYER_SELECT },
        results: true,
      },
    });
    return { ...d, challenge };
  }

  async getResultSubmitDelay(): Promise<number> {
    return this.config.getNumber("RESULT_SUBMIT_DELAY_MINS");
  }

  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [total, active, disputed, completedToday, revenue] = await Promise.all([
      this.prisma.challenge.count(),
      this.prisma.challenge.count({
        where: { status: { in: ["OPEN", "MATCHED", "ROOM_SHARED", "ONGOING"] } },
      }),
      this.prisma.challengeDispute.count({ where: { status: "OPEN" } }),
      this.prisma.challenge.count({
        where: { status: "COMPLETED", endedAt: { gte: todayStart } },
      }),
      this.prisma.challenge.aggregate({
        where: { status: "COMPLETED", endedAt: { gte: todayStart } },
        _sum: { platformFee: true },
      }),
    ]);
    return {
      total,
      active,
      disputed,
      completedToday,
      revenueToday: revenue._sum.platformFee ?? 0,
    };
  }

  async listAdmin(filters: { status?: ChallengeStatus; gameMode?: ChallengGameMode; limit?: number }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.gameMode) where.gameMode = filters.gameMode;
    return this.prisma.challenge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: this.normalizeListLimit(filters.limit),
      include: {
        creator: { select: { id: true, name: true, email: true } },
        opponent: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listDisputes() {
    const disputes = await this.prisma.challengeDispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "desc" },
    });
    const challenges = disputes.length
      ? await this.prisma.challenge.findMany({
          where: { id: { in: disputes.map((d) => d.challengeId) } },
          select: {
            id: true,
            challengeNumber: true,
            title: true,
            gameMode: true,
            entryFee: true,
            prizeToWinner: true,
            status: true,
            creator: { select: PLAYER_SELECT },
            opponent: { select: PLAYER_SELECT },
          },
        })
      : [];
    const byId = new Map(challenges.map((challenge) => [challenge.id, challenge]));
    return disputes.map((dispute) => ({
      ...dispute,
      challenge: byId.get(dispute.challengeId) ?? null,
    }));
  }

  private randomCode(len: number) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  private listCacheKey(filters: {
    gameMode?: ChallengGameMode;
    status?: ChallengeStatus;
    limit?: number;
  }) {
    return `${CHALLENGE_LIST_CACHE_PREFIX}${JSON.stringify({
      gameMode: filters.gameMode ?? null,
      status: filters.status ?? "OPEN",
      limit: this.normalizeListLimit(filters.limit),
    })}`;
  }

  private normalizeListLimit(limit?: number) {
    if (!Number.isFinite(limit)) return 50;
    return Math.min(Math.max(Math.trunc(limit!), 1), 100);
  }

  private detailCacheKey(challengeId: string) {
    return `${CHALLENGE_DETAIL_CACHE_PREFIX}${challengeId}`;
  }

  private invalidateChallengeCaches(challengeId?: string | null) {
    this.cache.delPrefix(CHALLENGE_LIST_CACHE_PREFIX);
    if (challengeId) this.cache.del(this.detailCacheKey(challengeId));
    else this.cache.delPrefix(CHALLENGE_DETAIL_CACHE_PREFIX);
  }
}
