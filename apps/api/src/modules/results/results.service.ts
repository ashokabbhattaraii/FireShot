import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, TournamentStatus } from '@fireslot/db';
import { PRISMA } from '../../prisma/prisma.module';

@Injectable()
export class ResultsService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async submit(
    userId: string,
    body: { tournamentId: string; placement?: number; kills?: number; note?: string },
    fileUrl: string,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: body.tournamentId },
      select: { id: true, status: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    if (
      tournament.status !== TournamentStatus.PENDING_RESULTS &&
      tournament.status !== TournamentStatus.LIVE
    ) {
      throw new BadRequestException(
        `Cannot submit results when tournament is ${tournament.status}. Tournament must be LIVE or PENDING_RESULTS.`,
      );
    }

    const participant = await this.prisma.tournamentParticipant.findFirst({
      where: { tournamentId: body.tournamentId, userId, paid: true },
      select: { id: true },
    });
    if (!participant) {
      throw new ForbiddenException('You are not a paid participant of this tournament');
    }

    const existing = await this.prisma.matchResult.findFirst({
      where: { tournamentId: body.tournamentId, submittedById: userId },
    });
    if (existing) {
      throw new BadRequestException('You have already submitted a result for this tournament');
    }

    return this.prisma.matchResult.create({
      data: {
        tournamentId: body.tournamentId,
        submittedById: userId,
        placement: body.placement ? Number(body.placement) : null,
        kills: body.kills ? Number(body.kills) : null,
        note: body.note,
        screenshotUrl: fileUrl,
      },
    });
  }

  list(verified?: 'true' | 'false', tournamentId?: string) {
    const where: any = {};
    if (verified !== undefined) where.verified = verified === 'true';
    if (tournamentId) where.tournamentId = tournamentId;
    return this.prisma.matchResult.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { tournament: true, submitter: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string) {
    const r = await this.prisma.matchResult.findUnique({
      where: { id },
      include: { tournament: true, submitter: { include: { profile: true } } },
    });
    if (!r) throw new NotFoundException();
    return r;
  }

  async verify(adminId: string, id: string) {
    const r = await this.prisma.matchResult.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    await this.prisma.matchResult.update({ where: { id }, data: { verified: true } });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        action: 'VERIFY_RESULT',
        resource: 'match_result',
        resourceId: id,
      },
    });
    return { ok: true };
  }

  async update(
    adminId: string,
    id: string,
    body: { placement?: number | null; kills?: number | null; note?: string | null },
  ) {
    const r = await this.prisma.matchResult.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const updated = await this.prisma.matchResult.update({
      where: { id },
      data: {
        placement: body.placement === null || body.placement === undefined ? null : Number(body.placement),
        kills: body.kills === null || body.kills === undefined ? null : Number(body.kills),
        note: body.note === undefined ? r.note : body.note,
      },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        action: 'UPDATE_RESULT',
        resource: 'match_result',
        resourceId: id,
      },
    });
    return updated;
  }
}
