import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { PrismaClient } from '@fireslot/db';
import { PRISMA } from '../../prisma/prisma.module';
import { Errors } from '../../common/errors';

export class UpsertProfileDto {
  @IsString() @MinLength(4) freeFireUid!: string;
  @IsString() @MinLength(2) ign!: string;
  @IsInt() @Min(1) @Max(100) level!: number;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) headshotRate?: number;
  @IsOptional() @IsBoolean() isEmulator?: boolean;
}

@Injectable()
export class ProfileService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async assertFreeFireUidAllowed(freeFireUid: string) {
    const bannedIdentity = await this.prisma.bannedFreeFireUid.findUnique({
      where: { freeFireUid },
    });

    if (bannedIdentity) {
      throw new ForbiddenException(bannedIdentity.reason ?? Errors.BANNED);
    }
  }

  async blacklistFreeFireUid(input: { freeFireUid: string; userId?: string; reason?: string }) {
    return this.prisma.bannedFreeFireUid.upsert({
      where: { freeFireUid: input.freeFireUid },
      create: {
        freeFireUid: input.freeFireUid,
        userId: input.userId,
        reason: input.reason,
      },
      update: {
        userId: input.userId,
        reason: input.reason,
      },
    });
  }

  async removeFreeFireUidBlacklist(freeFireUid: string) {
    await this.prisma.bannedFreeFireUid.deleteMany({ where: { freeFireUid } });
  }

  async upsert(userId: string, dto: UpsertProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isBanned) throw new ForbiddenException(Errors.BANNED);

    return this.prisma.$transaction(async (tx) => {
      await this.assertFreeFireUidAllowed(dto.freeFireUid);
      return tx.playerProfile.upsert({
        where: { userId },
        update: dto,
        create: { ...dto, userId },
      });
    });
  }

  get(userId: string) {
    return this.prisma.playerProfile.findUnique({ where: { userId } });
  }
}
