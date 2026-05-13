import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient, FreeDailyWindow } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "./admin-action-log.service";
import { SystemConfigService } from "./system-config.service";

export interface FreeDailyWindowInput {
  label: string;
  windowStart: string;
  windowEnd: string;
  prizePool?: number;
  maxWinners?: number;
  daysOfWeek: number[];
  isActive?: boolean;
}

@Injectable()
export class FreeDailyWindowService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
    private config: SystemConfigService,
  ) {}

  getAll() {
    return this.prisma.freeDailyWindow.findMany({ orderBy: [{ isActive: "desc" }, { windowStart: "asc" }] });
  }

  async create(dto: FreeDailyWindowInput, adminId: string, ip?: string | null) {
    this.validate(dto);
    const created = await this.prisma.freeDailyWindow.create({
      data: {
        label: dto.label,
        windowStart: dto.windowStart,
        windowEnd: dto.windowEnd,
        prizePool: dto.prizePool ?? this.config.getNumber("FREE_DAILY_PRIZE_POOL"),
        maxWinners: dto.maxWinners ?? 1,
        daysOfWeek: dto.daysOfWeek,
        isActive: dto.isActive ?? true,
        createdBy: adminId,
      },
    });
    await this.logs.log(adminId, "schedule.create", "free_daily_window", created.id, null, dto, ip);
    return created;
  }

  async update(id: string, dto: Partial<FreeDailyWindowInput>, adminId: string, ip?: string | null) {
    const existing = await this.prisma.freeDailyWindow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (dto.windowStart && dto.windowEnd) this.validate({ ...existing, ...dto } as FreeDailyWindowInput);
    const updated = await this.prisma.freeDailyWindow.update({
      where: { id },
      data: { ...dto },
    });
    await this.logs.log(adminId, "schedule.update", "free_daily_window", id, existing, dto, ip);
    return updated;
  }

  async remove(id: string, adminId: string, ip?: string | null) {
    const existing = await this.prisma.freeDailyWindow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.freeDailyWindow.delete({ where: { id } });
    await this.logs.log(adminId, "schedule.delete", "free_daily_window", id, existing, null, ip);
    return { ok: true };
  }

  async getTodayActiveWindows(): Promise<FreeDailyWindow[]> {
    const today = new Date().getDay();
    const all = await this.prisma.freeDailyWindow.findMany({ where: { isActive: true } });
    return all.filter((w) => w.daysOfWeek.includes(today));
  }

  async isUserEligible(userId: string) {
    const cooldownHours = this.config.getNumber("FREE_DAILY_COOLDOWN_HOURS");
    const maxPerDay = this.config.getNumber("FREE_DAILY_MAX_PER_DAY");
    const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

    const slotsInWindow = await this.prisma.freeDailySlot.count({
      where: { userId, usedAt: { gte: since } },
    });
    if (slotsInWindow >= maxPerDay) {
      const last = await this.prisma.freeDailySlot.findFirst({
        where: { userId },
        orderBy: { usedAt: "desc" },
      });
      const next = last ? new Date(last.usedAt.getTime() + cooldownHours * 60 * 60 * 1000) : null;
      return {
        eligible: false,
        nextWindowAt: next?.toISOString() ?? null,
        prizePool: this.config.getNumber("FREE_DAILY_PRIZE_POOL"),
        cooldownHours,
      };
    }

    const windows = await this.getTodayActiveWindows();
    const now = new Date();
    const inWindow = windows.find((w) => this.isWithin(now, w.windowStart, w.windowEnd));
    if (windows.length > 0 && !inWindow) {
      const next = this.nextWindowStart(windows);
      return {
        eligible: false,
        nextWindowAt: next?.toISOString() ?? null,
        prizePool: this.config.getNumber("FREE_DAILY_PRIZE_POOL"),
        cooldownHours,
      };
    }

    return {
      eligible: true,
      nextWindowAt: null,
      prizePool: inWindow?.prizePool ?? this.config.getNumber("FREE_DAILY_PRIZE_POOL"),
      cooldownHours,
    };
  }

  private validate(dto: FreeDailyWindowInput) {
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!re.test(dto.windowStart) || !re.test(dto.windowEnd))
      throw new BadRequestException("Window times must be HH:MM 24hr");
    if (this.toMin(dto.windowEnd) <= this.toMin(dto.windowStart))
      throw new BadRequestException("windowEnd must be after windowStart");
    if (!dto.daysOfWeek?.length) throw new BadRequestException("daysOfWeek required");
    if (dto.daysOfWeek.some((d) => d < 0 || d > 6))
      throw new BadRequestException("daysOfWeek must be 0-6");
  }

  private toMin(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  private isWithin(now: Date, start: string, end: string) {
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= this.toMin(start) && cur < this.toMin(end);
  }

  private nextWindowStart(windows: FreeDailyWindow[]): Date | null {
    if (!windows.length) return null;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const future = windows
      .map((w) => this.toMin(w.windowStart))
      .filter((m) => m > cur)
      .sort((a, b) => a - b);
    const d = new Date(now);
    if (future.length) {
      d.setHours(Math.floor(future[0] / 60), future[0] % 60, 0, 0);
      return d;
    }
    // tomorrow's earliest
    const earliest = Math.min(...windows.map((w) => this.toMin(w.windowStart)));
    d.setDate(d.getDate() + 1);
    d.setHours(Math.floor(earliest / 60), earliest % 60, 0, 0);
    return d;
  }
}
