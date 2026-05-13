import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { Inject } from "@nestjs/common";
import { PRISMA } from "../../prisma/prisma.module";

@Injectable()
export class ApkTestService {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  async startTestSession(adminId: string, buildVersion: string, deviceInfo?: any) {
    if (!adminId || !buildVersion) throw new BadRequestException("adminId and buildVersion required");
    const created = await (this.prisma as any).appTestSession.create({
      data: {
        adminId,
        buildVersion,
        deviceInfo: deviceInfo ?? null,
      },
    });
    return created;
  }

  async reportBug(sessionId: string, adminId: string, payload: { title: string; description?: string; screenshotUrl?: string }) {
    const session = await (this.prisma as any).appTestSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    if (session.adminId !== adminId) throw new BadRequestException("not your session");

    const bugs = Array.isArray(session.bugsFound) ? session.bugsFound : JSON.parse(String(session.bugsFound || '[]'));
    const bug = { title: payload.title, description: payload.description || null, screenshot: payload.screenshotUrl || null, reportedAt: new Date().toISOString() };
    bugs.push(bug);

    await (this.prisma as any).appTestSession.update({ where: { id: sessionId }, data: { bugsFound: bugs as any } });

    // Create a support ticket to track the bug
    try {
      await this.prisma.supportTicket.create({
        data: {
          ticketNumber: `APK-${Date.now()}`,
          userId: adminId,
          category: 'GENERAL',
          subject: `[APK BUG] ${payload.title}`,
          status: 'OPEN',
          priority: 'HIGH',
          messages: {
            create: [{ senderId: adminId, senderRole: 'ADMIN', message: payload.description || payload.title }],
          },
        },
      });
    } catch {
      // ignore ticket creation failure
    }

    return { ok: true, bug };
  }

  async endTestSession(sessionId: string, adminId: string, testNotes?: string) {
    const session = await (this.prisma as any).appTestSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    if (session.adminId !== adminId) throw new BadRequestException("not your session");
    const updated = await (this.prisma as any).appTestSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED', testNotes: testNotes ?? null, endedAt: new Date() } });
    return updated;
  }

  async getTestSessions(adminId: string) {
    return (this.prisma as any).appTestSession.findMany({ where: { adminId }, orderBy: { startedAt: 'desc' } });
  }

  async getLatestBugReports() {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const sessions = await (this.prisma as any).appTestSession.findMany({ where: { startedAt: { gte: since } } });
    const bugs = [] as any[];
    for (const s of sessions) {
      const list = Array.isArray(s.bugsFound) ? s.bugsFound : JSON.parse(String(s.bugsFound || '[]'));
      for (const b of list) bugs.push({ sessionId: s.id, adminId: s.adminId, buildVersion: s.buildVersion, ...b });
    }
    return bugs.sort((a, b) => (b.reportedAt > a.reportedAt ? 1 : -1));
  }
}
