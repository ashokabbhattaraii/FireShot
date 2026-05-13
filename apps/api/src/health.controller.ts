import { Controller, Get, HttpCode, HttpStatus, Inject } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "./prisma/prisma.module";

@Controller()
export class HealthController {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  /** Liveness probe — always returns 200 if the process is up. */
  @Get("health/live")
  @HttpCode(HttpStatus.OK)
  live() {
    return { ok: true };
  }

  /** Readiness probe — 200 only if downstream deps respond. */
  @Get("health/ready")
  async ready() {
    const checks = await this.runChecks();
    const ok = Object.values(checks).every((c) => c.ok);
    return { ok, checks, timestamp: new Date().toISOString() };
  }

  /** Detailed health view (default endpoint). */
  @Get("health")
  async health() {
    const checks = await this.runChecks();
    return {
      ok: Object.values(checks).every((c) => c.ok),
      service: "fireslot-api",
      uptime: process.uptime(),
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async runChecks() {
    const out: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

    const dbStart = Date.now();
    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");
      out.db = { ok: true, ms: Date.now() - dbStart };
    } catch (e: any) {
      out.db = { ok: false, ms: Date.now() - dbStart, error: e.message };
    }

    return out;
  }
}
