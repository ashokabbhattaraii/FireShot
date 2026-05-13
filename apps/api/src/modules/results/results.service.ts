import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@fireslot/db';
import { PRISMA } from '../../prisma/prisma.module';

@Injectable()
export class ResultsService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  submit(
    userId: string,
    body: { tournamentId: string; placement?: number; kills?: number; note?: string },
    fileUrl: string,
  ) {
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

  list(verified?: 'true' | 'false') {
    return this.prisma.matchResult.findMany({
      where: verified === undefined ? undefined : { verified: verified === 'true' },
      include: { tournament: true, submitter: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
}
