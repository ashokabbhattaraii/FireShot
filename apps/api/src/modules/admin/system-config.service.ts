import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigCategory, ConfigType, PrismaClient, SystemConfig } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "./admin-action-log.service";

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private cache = new Map<string, SystemConfig>();
  private refreshPromise: Promise<void> | null = null;

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
  ) {}

  onModuleInit() {
    if (process.env.SYSTEM_CONFIG_BOOT_SYNC === "true") {
      return this.refresh();
    }
    this.refreshPromise = this.refresh()
      .catch((e) => this.logger.warn(`[SystemConfig] Background refresh failed: ${e.message}`))
      .finally(() => {
        this.refreshPromise = null;
      });
  }

  async refresh() {
    try {
      const all = await this.prisma.systemConfig.findMany();
      this.cache.clear();
      for (const c of all) this.cache.set(c.key, c);
    } catch (e: any) {
      // Tolerate boot before migrations are applied (P2021 = table missing).
      if (e?.code === "P2021") {
        this.logger.warn(
          "[SystemConfig] Table missing — run `pnpm --filter @fireslot/db prisma migrate deploy` then `prisma db seed`.",
        );
        this.cache.clear();
        return;
      }
      if (this.isDatabaseUnavailable(e)) {
        this.logger.warn(
          "[SystemConfig] Database unavailable during config refresh; using built-in fallback config values.",
        );
        this.cache.clear();
        return;
      }
      throw e;
    }
  }

  async ready() {
    await this.refreshPromise;
  }

  private isDatabaseUnavailable(e: any): boolean {
    return (
      e?.code === "P1001" ||
      e?.name === "PrismaClientInitializationError" ||
      String(e?.message ?? "").includes("Can't reach database server")
    );
  }

  private static DEFAULTS: Record<
    string,
    { value: string; type: ConfigType; category: ConfigCategory; label: string }
  > = {
    MAX_ENTRY_FEE: { value: "50", type: "NUMBER", category: "PRICING", label: "Max Entry Fee (NPR)" },
    MIN_ENTRY_FEE: { value: "10", type: "NUMBER", category: "PRICING", label: "Min Entry Fee (NPR)" },
    SYSTEM_FEE_PERCENT: { value: "20", type: "NUMBER", category: "PRICING", label: "Tournaments Platform Cut %" },
    CHALLENGE_FEE_PERCENT: { value: "20", type: "NUMBER", category: "PRICING", label: "Challenges Platform Cut %" },
    WITHDRAWAL_FEE_PERCENT: { value: "0", type: "NUMBER", category: "PRICING", label: "Withdrawal Fee %" },
    MIN_DEPOSIT_AMOUNT_NPR: { value: "20", type: "NUMBER", category: "PRICING", label: "Minimum Deposit Amount (NPR)" },
    MIN_WITHDRAWAL_AMOUNT_NPR: { value: "100", type: "NUMBER", category: "PRICING", label: "Minimum Withdrawal Amount (NPR)" },
    MIN_SYSTEM_FEE: { value: "5", type: "NUMBER", category: "PRICING", label: "Min Platform Fee" },
    KILL_REWARD_PERCENT: { value: "80", type: "NUMBER", category: "PRICING", label: "Kill+Booyah Pool %" },
    BOOYAH_COINS_PER_PLAYER: { value: "1", type: "NUMBER", category: "PRICING", label: "Booyah Coins / Player" },
    MIN_PLAYERS_TO_START: { value: "10", type: "NUMBER", category: "PRICING", label: "Min Players to Start" },
    FREE_DAILY_PRIZE_POOL: { value: "100", type: "NUMBER", category: "PRICING", label: "Free Daily Prize Pool" },
    PRIZE_POOL_NOTE: {
      value: "Prize pool scales with actual players. Entry fee is your only risk.",
      type: "STRING",
      category: "PRICING",
      label: "Pool Disclaimer",
    },
    HEADSHOT_RATE_LIMIT: { value: "70", type: "NUMBER", category: "TOURNAMENT", label: "Default Max Headshot Rate %" },
    MIN_LEVEL_REQUIRED: { value: "40", type: "NUMBER", category: "TOURNAMENT", label: "Default Min FF Level" },
    FREE_DAILY_COOLDOWN_HOURS: { value: "24", type: "NUMBER", category: "SCHEDULE", label: "Free Daily Cooldown (hrs)" },
    FREE_DAILY_MAX_PER_DAY: { value: "1", type: "NUMBER", category: "SCHEDULE", label: "Free Daily Max / day" },
    KILL_RACE_ENABLED: { value: "true", type: "BOOLEAN", category: "TOURNAMENT", label: "Kill Race Enabled" },
    DEFAULT_PRIZE_SPLITS: {
      value: '{"SOLO_TOP3":[50,30,20],"SQUAD_TOP10":[25,18,12,8,8,3,3,3,3,3]}',
      type: "JSON",
      category: "TOURNAMENT",
      label: "Default Prize Splits",
    },
    MAINTENANCE_MODE: { value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Maintenance Mode" },
    NEW_USER_BONUS_ENABLED: { value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "New User Bonus Enabled" },
    NEW_USER_BONUS_AMOUNT: { value: "50", type: "NUMBER", category: "FEATURE_FLAG", label: "New User Bonus (NPR)" },
    APP_MAINTENANCE_ENABLED: { value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "App Maintenance Enabled" },
    APP_MAINTENANCE_MESSAGE: {
      value: "FireSlot Nepal is updating. Please try again soon.",
      type: "STRING",
      category: "FEATURE_FLAG",
      label: "App Maintenance Message",
    },
    APP_ANNOUNCEMENT_ACTIVE: { value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Announcement Active" },
    APP_ANNOUNCEMENT_TEXT: { value: "", type: "STRING", category: "FEATURE_FLAG", label: "Announcement Text" },
    APP_ANNOUNCEMENT_COLOR: { value: "#E53935", type: "STRING", category: "FEATURE_FLAG", label: "Announcement Color" },
    APP_FORCE_UPDATE_ENABLED: { value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Force Android Update" },
    APP_MIN_ANDROID_VERSION: { value: "1.0.0", type: "STRING", category: "FEATURE_FLAG", label: "Minimum Android App Version" },
    APP_LATEST_VERSION: { value: "1.0.0", type: "STRING", category: "FEATURE_FLAG", label: "Fallback Latest App Version" },
    APP_API_URL: { value: "", type: "STRING", category: "FEATURE_FLAG", label: "Public API URL" },
    APP_PUBLIC_WEB_URL: { value: "", type: "STRING", category: "FEATURE_FLAG", label: "Public Web URL" },
    APP_DOWNLOAD_ENABLED: { value: "true", type: "BOOLEAN", category: "FEATURE_FLAG", label: "APK Download Enabled" },
    APP_SUPPORT_URL: { value: "/support", type: "STRING", category: "FEATURE_FLAG", label: "App Support URL" },
    RESULT_SUBMIT_DELAY_MINS: { value: "10", type: "NUMBER", category: "TOURNAMENT", label: "Result Submit Delay After Room Share (mins)" },
    REFERRAL_ENABLED: { value: "true", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Referral Program Enabled" },
    REFERRAL_SIGNUP_REWARD_NPR: { value: "10", type: "NUMBER", category: "FEATURE_FLAG", label: "Referral Signup Bonus (NPR)" },
    REFERRAL_FIRST_DEPOSIT_REWARD_NPR: { value: "10", type: "NUMBER", category: "FEATURE_FLAG", label: "Referrer First Deposit Reward (NPR)" },
  };

  get(key: string): string {
    const c = this.cache.get(key);
    if (c) return c.value;
    const fb = SystemConfigService.DEFAULTS[key];
    if (fb !== undefined) return fb.value;
    throw new BadRequestException(`Unknown config key ${key}`);
  }

  getOr(key: string, fallback: string): string {
    return this.cache.get(key)?.value ?? fallback;
  }

  getNumber(key: string): number {
    const v = this.get(key);
    const n = Number(v);
    if (Number.isNaN(n)) throw new BadRequestException(`Config ${key} is not a number`);
    return n;
  }

  getBool(key: string): boolean {
    return this.get(key).toLowerCase() === "true";
  }

  getJson<T = any>(key: string): T {
    return JSON.parse(this.get(key)) as T;
  }

  async getAll(): Promise<SystemConfig[]> {
    let items: SystemConfig[] = [];
    try {
      items = await this.prisma.systemConfig.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] });
    } catch (e: any) {
      if (e?.code !== "P2021" && !this.isDatabaseUnavailable(e)) throw e;
    }
    return this.withDefaults(items);
  }

  async getByCategory(category: ConfigCategory): Promise<SystemConfig[]> {
    return (await this.getAll()).filter((c) => c.category === category);
  }

  async set(key: string, value: string, adminId: string, ip?: string | null) {
    const existing = await this.prisma.systemConfig.findUnique({ where: { key } });
    const fallback = SystemConfigService.DEFAULTS[key];
    if (!existing && !fallback) throw new BadRequestException(`Unknown config key ${key}`);
    const type = existing?.type ?? fallback!.type;
    this.validateValue(type, value);

    const updated = existing
      ? await this.prisma.systemConfig.update({
          where: { key },
          data: { value, updatedBy: adminId },
        })
      : await this.prisma.systemConfig.create({
          data: {
            key,
            value,
            type,
            category: fallback!.category,
            label: fallback!.label,
            updatedBy: adminId,
          },
        });
    this.cache.set(key, updated);
    await this.logs.log(adminId, "config.update", "config", key, { value: existing?.value ?? fallback?.value }, { value }, ip);
    return updated;
  }

  async bulkSet(updates: { key: string; value: string }[], adminId: string, ip?: string | null) {
    const results: SystemConfig[] = [];
    await this.prisma.$transaction(async (tx: any) => {
      for (const u of updates) {
        const existing = await tx.systemConfig.findUnique({ where: { key: u.key } });
        const fallback = SystemConfigService.DEFAULTS[u.key];
        if (!existing && !fallback) throw new BadRequestException(`Unknown config key ${u.key}`);
        const type = existing?.type ?? fallback!.type;
        this.validateValue(type, u.value);
        const updated = existing
          ? await tx.systemConfig.update({
              where: { key: u.key },
              data: { value: u.value, updatedBy: adminId },
            })
          : await tx.systemConfig.create({
              data: {
                key: u.key,
                value: u.value,
                type,
                category: fallback!.category,
                label: fallback!.label,
                updatedBy: adminId,
              },
            });
        results.push(updated);
      }
    });
    for (const r of results) this.cache.set(r.key, r);
    await this.logs.log(adminId, "config.bulk_update", "config", null, null, { updates }, ip);
    return results;
  }

  private validateValue(type: ConfigType, value: string) {
    switch (type) {
      case "NUMBER":
        if (Number.isNaN(Number(value))) throw new BadRequestException("Value must be a number");
        break;
      case "BOOLEAN":
        if (!["true", "false"].includes(value.toLowerCase()))
          throw new BadRequestException("Value must be true/false");
        break;
      case "JSON":
        try { JSON.parse(value); } catch { throw new BadRequestException("Value must be valid JSON"); }
        break;
    }
  }

  private withDefaults(items: SystemConfig[]): SystemConfig[] {
    const byKey = new Map(items.map((item) => [item.key, item]));
    const defaults = Object.entries(SystemConfigService.DEFAULTS)
      .filter(([key]) => !byKey.has(key))
      .map(([key, value]) => ({
        id: `default:${key}`,
        key,
        value: value.value,
        type: value.type,
        category: value.category,
        label: value.label,
        updatedAt: new Date(0),
        updatedBy: null,
      }) as SystemConfig);

    return [...items, ...defaults].sort((a, b) => {
      const cat = String(a.category).localeCompare(String(b.category));
      if (cat) return cat;
      return a.label.localeCompare(b.label);
    });
  }
}
