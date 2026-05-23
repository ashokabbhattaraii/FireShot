import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@fireslot/db';
import { PRISMA } from '../../prisma/prisma.module';

@Injectable()
export class ResultsService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async submit(
    userId: string,
    body: { tournamentId: string; placement?: number; kills?: number; note?: string },
    fileUrl: string,
  ) {
    throw new BadRequestException(
      'Tournament results are managed by admin. Players do not submit tournament results.',
    );
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
