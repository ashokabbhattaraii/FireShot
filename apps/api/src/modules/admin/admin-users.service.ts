import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { PrismaClient, Role } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "./admin-action-log.service";
import { ProfileService } from "../profile/profile.service";

export class AdminUpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) avatarUrl?: string | null;
  @IsOptional() @IsBoolean() isBanned?: boolean;
  @IsOptional() @IsBoolean() isLocked?: boolean;
  @IsOptional() profile?: {
    ign?: string;
    freeFireUid?: string;
    level?: number;
    region?: string | null;
    avatarUrl?: string | null;
    headshotRate?: number | null;
    isEmulator?: boolean;
    isBlacklisted?: boolean;
    blacklistReason?: string | null;
  };
}

export class BalanceAdjustmentDto {
  @IsNumber() amountNpr!: number;
  @IsString() @IsIn(["ADMIN_ADJUSTMENT", "PAYMENT_CORRECTION", "REFUND", "PENALTY"])
  actionType!: string;
  @IsString() @MinLength(10) @MaxLength(500) comment!: string;
  @IsOptional() @IsBoolean() confirmLargeAdjustment?: boolean;
}

const USER_LIST_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  avatarUrl: true,
  role: true,
  roleId: true,
  roleRef: { select: { id: true, name: true, isSystem: true } },
  isBanned: true,
  isLocked: true,
  sessionVersion: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  profile: true,
  wallet: true,
  _count: { select: { permissionOverrides: true } },
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
    private profiles: ProfileService,
  ) {}

  async listUsers() {
    return this.prisma.user.findMany({
      select: USER_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async getProfile(actorId: string, targetUserId: string) {
    const [actor, target] = await Promise.all([
      this.getActor(actorId),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          ...USER_LIST_SELECT,
          payments: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, amountNpr: true, status: true, method: true, createdAt: true, reviewedAt: true },
          },
          withdrawals: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, amountNpr: true, status: true, method: true, createdAt: true, reviewedAt: true },
          },
          balanceAdjustmentsReceived: {
            orderBy: { createdAt: "desc" },
            take: 25,
            include: { actor: { select: { id: true, email: true, name: true } } },
          },
        },
      }),
    ]);
    if (!target) throw new NotFoundException("User not found");
    this.assertCanView(actor, target.role);

    const audit = await this.prisma.adminActionLog.findMany({
      where: { resource: "user", resourceId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { admin: { select: { id: true, email: true, name: true } } },
    });

    return { user: target, audit };
  }

  async updateProfile(
    actorId: string,
    targetUserId: string,
    dto: AdminUpdateUserDto,
    ip?: string | null,
  ) {
    const actor = await this.getActor(actorId);
    const before = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });
    if (!before) throw new NotFoundException("User not found");
    this.assertCanWrite(actor, before.role);

    const userData: any = {};
    for (const key of ["name", "phone", "avatarUrl"] as const) {
      if (key in dto) userData[key] = this.cleanNullableString(dto[key]);
    }

    if (actor.role === "SUPER_ADMIN") {
      if (dto.isBanned !== undefined) userData.isBanned = dto.isBanned;
      if (dto.isLocked !== undefined) userData.isLocked = dto.isLocked;
    } else if (dto.isBanned !== undefined || dto.isLocked !== undefined) {
      throw new ForbiddenException("Only SUPER_ADMIN can update account status flags");
    }

    const profileData = this.profileUpdateData(dto.profile, actor.role === "SUPER_ADMIN");

    try {
      const updated = await this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          ...userData,
          profile:
            profileData && before.profile
              ? { update: profileData }
              : profileData && !before.profile && profileData.freeFireUid && profileData.ign
                ? { create: profileData }
                : undefined,
        },
        select: USER_LIST_SELECT,
      });

      if (updated.profile?.freeFireUid && updated.isBanned) {
        await this.profiles.blacklistFreeFireUid({
          freeFireUid: updated.profile.freeFireUid,
          userId: targetUserId,
          reason: updated.profile.blacklistReason ?? "Account banned",
        });
      }
      if (before.profile?.freeFireUid && !updated.isBanned && before.isBanned) {
        await this.profiles.removeFreeFireUidBlacklist(before.profile.freeFireUid);
      }

      await this.logs.log(
        actorId,
        "user.profile_update",
        "user",
        targetUserId,
        this.redactUserForLog(before),
        this.redactUserForLog(updated),
        ip,
      );
      return updated;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new BadRequestException("Email, phone, or Free Fire UID is already used");
      }
      throw error;
    }
  }

  async setSuspended(
    actorId: string,
    targetUserId: string,
    suspended: boolean,
    ip?: string | null,
  ) {
    return this.updateStatusFlag(actorId, targetUserId, "isBanned", suspended, ip);
  }

  async setLocked(
    actorId: string,
    targetUserId: string,
    locked: boolean,
    ip?: string | null,
  ) {
    return this.updateStatusFlag(actorId, targetUserId, "isLocked", locked, ip);
  }

  async resetSessions(actorId: string, targetUserId: string, ip?: string | null) {
    const actor = await this.getActor(actorId);
    if (actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Only SUPER_ADMIN can reset sessions");
    }
    const before = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (!before) throw new NotFoundException("User not found");
    this.assertCanWrite(actor, before.role);

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { sessionVersion: { increment: 1 } },
      select: USER_LIST_SELECT,
    });
    await this.logs.log(
      actorId,
      "user.sessions_reset",
      "user",
      targetUserId,
      { sessionVersion: before.sessionVersion },
      { sessionVersion: updated.sessionVersion },
      ip,
    );
    return updated;
  }

  async adjustBalance(
    actorId: string,
    targetUserId: string,
    dto: BalanceAdjustmentDto,
    ip?: string | null,
  ) {
    const comment = dto.comment?.trim();
    const amount = Math.trunc(Number(dto.amountNpr));
    if (!comment) throw new BadRequestException("comment is required");
    if (comment.length < 10) throw new BadRequestException("comment must be at least 10 characters");
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException("amountNpr must be a non-zero number");
    }
    if (Math.abs(amount) >= 10_000 && !dto.confirmLargeAdjustment) {
      throw new BadRequestException("Large balance adjustments require second confirmation");
    }

    const actor = await this.getActor(actorId);
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "FINANCE") {
      throw new ForbiddenException("Only SUPER_ADMIN or permitted FINANCE users can adjust balances");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException("User not found");
    this.assertCanWrite(actor, target.role);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: targetUserId },
        create: { userId: targetUserId, balanceNpr: 0 },
        update: {},
      });
      const previousBalance = wallet.balanceNpr;
      const newBalance = previousBalance + amount;
      if (newBalance < 0) {
        throw new BadRequestException("Adjustment would make wallet balance negative");
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceNpr: newBalance },
      });
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: amount > 0 ? "CREDIT" : "DEBIT",
          reason: dto.actionType === "REFUND" ? "REFUND" : "ADJUSTMENT",
          amountNpr: Math.abs(amount),
          note: comment,
        },
      });
      const adjustment = await tx.balanceAdjustment.create({
        data: {
          actorId,
          targetUserId,
          walletTxId: walletTx.id,
          actionType: dto.actionType,
          amountNpr: amount,
          previousBalance,
          newBalance,
          comment,
        },
      });
      await tx.notification.create({
        data: {
          userId: targetUserId,
          type: "PAYMENT",
          title: amount > 0 ? "Wallet balance credited" : "Wallet balance adjusted",
          body: `${amount > 0 ? "Credit" : "Debit"} of NPR ${Math.abs(amount)}. New balance: NPR ${newBalance}. Reason: ${comment}`,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: actorId,
          action: "wallet.balance_adjustment",
          resource: "user",
          resourceId: targetUserId,
          oldValue: { balanceNpr: previousBalance },
          newValue: {
            balanceNpr: updatedWallet.balanceNpr,
            amountNpr: amount,
            actionType: dto.actionType,
            comment,
            adjustmentId: adjustment.id,
          },
          ip,
        },
      });
      return { wallet: updatedWallet, adjustment };
    });
  }

  private async updateStatusFlag(
    actorId: string,
    targetUserId: string,
    field: "isBanned" | "isLocked",
    value: boolean,
    ip?: string | null,
  ) {
    const actor = await this.getActor(actorId);
    if (actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Only SUPER_ADMIN can change this status");
    }
    const before = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });
    if (!before) throw new NotFoundException("User not found");
    this.assertCanWrite(actor, before.role);

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { [field]: value },
      select: USER_LIST_SELECT,
    });

    if (field === "isBanned" && before.profile?.freeFireUid) {
      if (value) {
        await this.profiles.blacklistFreeFireUid({
          freeFireUid: before.profile.freeFireUid,
          userId: targetUserId,
          reason: before.profile.blacklistReason ?? "Account banned",
        });
      } else {
        await this.profiles.removeFreeFireUidBlacklist(before.profile.freeFireUid);
      }
    }

    await this.logs.log(
      actorId,
      field === "isBanned" ? (value ? "user.suspend" : "user.unsuspend") : (value ? "user.lock" : "user.unlock"),
      "user",
      targetUserId,
      { [field]: before[field] },
      { [field]: value },
      ip,
    );
    return updated;
  }

  private async getActor(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, roleRef: { select: { name: true } } },
    });
    if (!actor) throw new ForbiddenException("Invalid admin");
    return actor;
  }

  private assertCanView(actor: { role: Role }, targetRole: Role) {
    if (targetRole === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("SUPER_ADMIN profile access required");
    }
  }

  private assertCanWrite(actor: { id: string; role: Role }, targetRole: Role) {
    this.assertCanView(actor, targetRole);
    if (targetRole === "SUPER_ADMIN" && actor.role === "SUPER_ADMIN") return;
  }

  private cleanNullableString(value: string | null | undefined) {
    if (value === null) return null;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private profileUpdateData(profile: AdminUpdateUserDto["profile"], superAdmin: boolean) {
    if (!profile) return undefined;
    const allowed: any = {};
    for (const key of ["ign", "region", "avatarUrl"] as const) {
      if (key in profile) allowed[key] = this.cleanNullableString(profile[key] as any);
    }
    if ("level" in profile && profile.level !== undefined) allowed.level = Number(profile.level);
    if ("headshotRate" in profile) {
      allowed.headshotRate = profile.headshotRate == null ? null : Number(profile.headshotRate);
    }
    if ("isEmulator" in profile) allowed.isEmulator = Boolean(profile.isEmulator);

    if (superAdmin) {
      if ("freeFireUid" in profile) allowed.freeFireUid = this.cleanNullableString(profile.freeFireUid);
      if ("isBlacklisted" in profile) allowed.isBlacklisted = Boolean(profile.isBlacklisted);
      if ("blacklistReason" in profile) allowed.blacklistReason = this.cleanNullableString(profile.blacklistReason);
    } else if (
      "freeFireUid" in profile ||
      "isBlacklisted" in profile ||
      "blacklistReason" in profile
    ) {
      throw new ForbiddenException("Only SUPER_ADMIN can update verification or blacklist fields");
    }

    if (allowed.level !== undefined && (!Number.isInteger(allowed.level) || allowed.level < 1)) {
      throw new BadRequestException("profile.level must be a positive integer");
    }
    if (
      allowed.headshotRate !== undefined &&
      allowed.headshotRate !== null &&
      (allowed.headshotRate < 0 || allowed.headshotRate > 100)
    ) {
      throw new BadRequestException("profile.headshotRate must be between 0 and 100");
    }
    return Object.keys(allowed).length ? allowed : undefined;
  }

  private redactUserForLog(user: any) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isBanned: user.isBanned,
      isLocked: user.isLocked,
      sessionVersion: user.sessionVersion,
      profile: user.profile
        ? {
            freeFireUid: user.profile.freeFireUid,
            ign: user.profile.ign,
            level: user.profile.level,
            region: user.profile.region,
            isEmulator: user.profile.isEmulator,
            isBlacklisted: user.profile.isBlacklisted,
            blacklistReason: user.profile.blacklistReason,
          }
        : null,
    };
  }
}
