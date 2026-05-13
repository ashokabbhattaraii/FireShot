import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@fireslot/db';
import { PRISMA } from '../../prisma/prisma.module';
import { MemoryCacheService } from '../../common/cache/memory-cache.service';

const LEADERBOARD_CACHE_KEY = 'leaderboard:top50';
const LEADERBOARD_TTL_SECONDS = 60;

@Injectable()
export class UsersService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private cache: MemoryCacheService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true, isBanned: true, createdAt: true, profile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  setBan(id: string, banned: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isBanned: banned } });
  }

  async savePushToken(userId: string, token: string, platform = 'android') {
    return this.prisma.userPushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, updatedAt: new Date() },
    });
  }

  async leaderboard() {
    return this.cache.getStaleWhileRevalidate(
      LEADERBOARD_CACHE_KEY,
      LEADERBOARD_TTL_SECONDS,
      LEADERBOARD_TTL_SECONDS * 5,
      async () => {
        const rows = await this.prisma.tournamentParticipant.groupBy({
          by: ['userId'],
          _sum: { prizeEarned: true },
          orderBy: { _sum: { prizeEarned: 'desc' } },
          take: 50,
        });
        const ids = rows.map((r) => r.userId);
        const profiles = ids.length
          ? await this.prisma.user.findMany({
              where: { id: { in: ids } },
              select: {
                id: true,
                email: true,
                profile: { select: { ign: true } },
              },
            })
          : [];
        const byId = new Map(profiles.map((u) => [u.id, u]));
        return rows.map((r) => {
          const user = byId.get(r.userId);
          return {
            userId: r.userId,
            ign: user?.profile?.ign ?? user?.email,
            prizeEarned: r._sum.prizeEarned ?? 0,
          };
        });
      },
    );
  }

  async myMatches(userId: string) {
    const [tournaments, challenges] = await Promise.all([
      this.prisma.tournamentParticipant.findMany({
        where: { userId },
        include: {
          tournament: {
            select: {
              id: true,
              title: true,
              mode: true,
              type: true,
              status: true,
              dateTime: true,
              entryFeeNpr: true,
              prizePoolNpr: true,
              maxSlots: true,
              filledSlots: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      }),
      this.prisma.challenge.findMany({
        where: { OR: [{ creatorId: userId }, { opponentId: userId }] },
        include: {
          creator: { select: { id: true, name: true, profile: true } },
          opponent: { select: { id: true, name: true, profile: true } },
          results: {
            where: { userId },
            select: {
              userId: true,
              outcome: true,
              kills: true,
              submittedAt: true,
              isDisputed: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      tournaments,
      challenges,
      counts: {
        tournaments: tournaments.length,
        challenges: challenges.length,
        createdChallenges: challenges.filter((challenge) => challenge.creatorId === userId).length,
        joinedChallenges: challenges.filter((challenge) => challenge.opponentId === userId).length,
      },
    };
  }
}
