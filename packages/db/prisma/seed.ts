import { PrismaClient, GameMode, TournamentStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fireslot.np";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      wallet: { create: {} },
    },
  });

  console.log("Admin user:", admin.email);

  // Sample player
  const playerHash = await bcrypt.hash("Player@123", 10);
  const player = await prisma.user.upsert({
    where: { email: "player1@fireslot.np" },
    update: {},
    create: {
      email: "player1@fireslot.np",
      passwordHash: playerHash,
      role: Role.PLAYER,
      wallet: { create: { balanceNpr: 500 } },
      profile: {
        create: {
          freeFireUid: "1234567890",
          ign: "NepalPro1",
          level: 55,
          region: "Nepal",
        },
      },
    },
  });

  // Sample tournaments
  const samples = [
    {
      title: "FireSlot Solo Showdown",
      mode: GameMode.BR_SOLO,
      map: "Bermuda",
      entryFeeNpr: 40,
      registrationFeeNpr: 10,
      prizePoolNpr: 2000,
      perKillPrizeNpr: 10,
      firstPrize: 1000,
      secondPrize: 600,
      thirdPrize: 400,
      fourthToTenthPrize: 50,
      maxSlots: 48,
    },
    {
      title: "Kathmandu Squad Cup",
      mode: GameMode.BR_SQUAD,
      map: "Purgatory",
      entryFeeNpr: 50,
      registrationFeeNpr: 15,
      prizePoolNpr: 8000,
      perKillPrizeNpr: 20,
      firstPrize: 4000,
      secondPrize: 2500,
      thirdPrize: 1500,
      fourthToTenthPrize: 100,
      maxSlots: 12,
    },
    {
      title: "Clash Squad Weekly 4v4",
      mode: GameMode.CS_4V4,
      entryFeeNpr: 35,
      registrationFeeNpr: 10,
      prizePoolNpr: 3000,
      perKillPrizeNpr: 15,
      firstPrize: 2000,
      secondPrize: 1000,
      thirdPrize: 0,
      fourthToTenthPrize: 0,
      maxSlots: 16,
    },
    {
      title: "Lone Wolf 1v1 Arena",
      mode: GameMode.LW_1V1,
      entryFeeNpr: 30,
      registrationFeeNpr: 10,
      prizePoolNpr: 1000,
      perKillPrizeNpr: 5,
      firstPrize: 700,
      secondPrize: 300,
      thirdPrize: 0,
      fourthToTenthPrize: 0,
      maxSlots: 32,
    },
  ];

  for (const s of samples) {
    await prisma.tournament.create({
      data: {
        ...s,
        description: `Compete in ${s.title}. Entry NPR ${s.entryFeeNpr}.`,
        dateTime: new Date(
          Date.now() +
            1000 * 60 * 60 * 24 * (1 + Math.floor(Math.random() * 7)),
        ),
        status: TournamentStatus.UPCOMING,
        rules:
          "No teaming, no hacks. Submit screenshot within 10 minutes of match end.",
        isAdminCreated: true,
        createdById: admin.id,
      },
    });
  }

  console.log(
    "Seeded sample tournaments. Player:",
    player.email,
    "/ Player@123",
  );

  await seedGameCategories();
  await seedSystemConfig();
  await seedRolesAndSuperAdmin();
  await seedHeroBanners();
  await seedBotJobs();
  await seedFeatureFlags();
}

async function seedBotJobs() {
  const jobs = [
    {
      name: "PROFILE_ANALYZER",
      intervalMins: 30,
      description: "Scans profiles for incomplete data, duplicate FF UIDs, invalid UID formats",
      config: { minProfileAgeHours: 1, flagIncompleteAfterHours: 24, duplicateUidThreshold: 1 },
    },
    {
      name: "FRAUD_DETECTOR",
      intervalMins: 60,
      description: "Flags abnormal win rates, multi-account IPs, unusual withdrawals, new-account payment rushes",
      config: {
        winRateThreshold: 85,
        minTournamentsForWinRate: 8,
        suspiciousPaymentWindowMins: 3,
        maxSameIPPaymentsPerWindow: 3,
        unusualWithdrawalMultiplier: 5,
      },
    },
    {
      name: "TOURNAMENT_CLOSER",
      intervalMins: 10,
      description: "Auto-closes expired tournaments, refunds when below min players, flags stale results",
      config: { gracePeriodMins: 15, minPlayersForRefund: 2 },
    },
    {
      name: "WALLET_RECONCILER",
      intervalMins: 60,
      description: "Negative balances, orphan transactions, double-credit detection, auto-fix small drifts",
      config: { negativeBalanceGraceCents: 0, orphanTransactionAgeHours: 2 },
    },
    {
      name: "INACTIVE_NOTIFIER",
      intervalMins: 720,
      description: "Personalized tournament push to inactive users (7+ days), prioritizes wallet-funded users",
      config: { inactiveDays: 7, maxNotificationsPerRun: 100, cooldownDays: 7 },
    },
    {
      name: "LEADERBOARD_SYNC",
      intervalMins: 30,
      description: "Recalculates leaderboard from prize transactions, notifies on rank jumps",
      config: {},
    },
    {
      name: "PAYMENT_EXPIRY_HANDLER",
      intervalMins: 20,
      description: "Auto-rejects pending payments not reviewed within the configured window",
      config: { pendingPaymentExpiryHours: 24 },
    },
    {
      name: "RESULT_SUBMISSION_REMINDER",
      intervalMins: 30,
      description: "Reminds players to submit match results after tournament ends",
      config: { reminderAfterTournamentEndMins: 60 },
    },
  ];
  for (const j of jobs) {
    await prisma.botJob.upsert({
      where: { name: j.name },
      update: { description: j.description, config: j.config as any },
      create: {
        ...j,
        isEnabled: false,
        dryRunEnabled: true,
        maxActionsPerRun: 50,
        config: j.config as any,
      },
    });
  }
  console.log(`Seeded ${jobs.length} bot jobs (dryRun ON, disabled by default)`);
}

async function seedGameCategories() {
  // Wipe and reseed — categories are display-only metadata.
  await prisma.gameCategory.deleteMany({});

  const freeFire = await prisma.gameCategory.create({
    data: {
      name: "Free Fire",
      slug: "free-fire",
      sortOrder: 1,
      isActive: true,
      comingSoon: false,
      parentId: null,
      coverUrl: "/banners/ff-banner-1.svg",
    },
  });

  const ffSubs = [
    {
      name: "Battle Royale",
      slug: "ff-br",
      gameMode: "BR",
      sortOrder: 1,
      isActive: true,
      description:
        "Squad of 4, last team standing. Main esports format used in FFWS and all major tournaments.",
      coverUrl: "/banners/ff-banner-1.svg",
    },
    {
      name: "Clash Squad",
      slug: "ff-cs",
      gameMode: "CS",
      sortOrder: 2,
      isActive: true,
      description:
        "4v4 tactical rounds. Used in FF Pro League and ranked competitive play.",
      coverUrl: "/banners/ff-cs-banner.svg",
    },
    {
      name: "Lone Wolf",
      slug: "ff-lone-wolf",
      gameMode: "LW",
      sortOrder: 3,
      isActive: true,
      description:
        "1v1 head-to-head. Popular in small community tournaments and challenge matches.",
      coverUrl: "/banners/ff-banner-2.svg",
    },
    {
      name: "BR Ranked",
      slug: "ff-br-ranked",
      gameMode: "BR_RANKED",
      sortOrder: 4,
      isActive: true,
      description:
        "Battle Royale with ranked point scoring. Used for skill-based leaderboard tournaments.",
      coverUrl: "/banners/ff-banner-1.svg",
    },
  ];
  for (const sub of ffSubs) {
    await prisma.gameCategory.create({
      data: { ...sub, parentId: freeFire.id, comingSoon: false },
    });
  }

  await prisma.gameCategory.create({
    data: {
      name: "PUBG Mobile",
      slug: "pubg-mobile",
      sortOrder: 2,
      isActive: false,
      comingSoon: true,
      parentId: null,
    },
  });
  await prisma.gameCategory.create({
    data: {
      name: "Ludo King",
      slug: "ludo-king",
      sortOrder: 3,
      isActive: false,
      comingSoon: true,
      parentId: null,
    },
  });

  console.log("Seeded game categories: free-fire (+4 modes), pubg-mobile, ludo-king");
}

async function seedHeroBanners() {
  const banners = [
    {
      title: "Free Fire Tournaments",
      subtitle: "Win real cash — starting Rs 10 entry",
      imageUrl: "/banners/ff-banner-1.svg",
      ctaText: "Play Now",
      ctaLink: "/tournaments?category=ff-br",
      badgeText: "HOT",
      badgeColor: "#E53935",
      sortOrder: 1,
      isActive: true,
    },
    {
      title: "Daily Free Match",
      subtitle: "1 free match every 24 hours — Rs 100 prize pool",
      imageUrl: "/banners/ff-banner-2.svg",
      ctaText: "Join Free",
      ctaLink: "/tournaments?type=FREE_DAILY",
      badgeText: "FREE",
      badgeColor: "#4CAF50",
      sortOrder: 2,
      isActive: true,
    },
    {
      title: "Fast Withdrawals",
      subtitle: "Winnings credited instantly to your wallet",
      imageUrl: "/banners/feature-withdraw.svg",
      ctaText: "View Wallet",
      ctaLink: "/wallet",
      badgeText: null,
      badgeColor: null,
      sortOrder: 3,
      isActive: true,
    },
    {
      title: "24/7 Support",
      subtitle: "Raise a ticket — our team responds within 1 hour",
      imageUrl: "/banners/feature-support.svg",
      ctaText: "Get Help",
      ctaLink: "/support",
      badgeText: null,
      badgeColor: null,
      sortOrder: 4,
      isActive: true,
    },
    {
      title: "Clash Squad Challenges",
      subtitle: "1v1 to 4v4 — challenge any player for real money",
      imageUrl: "/banners/ff-cs-banner.svg",
      ctaText: "Challenge Now",
      ctaLink: "/challenges",
      badgeText: "NEW",
      badgeColor: "#9C27B0",
      sortOrder: 5,
      isActive: true,
    },
  ];

  for (const banner of banners) {
    const existing = await prisma.heroBanner.findFirst({
      where: { title: banner.title },
    });
    if (existing) {
      await prisma.heroBanner.update({
        where: { id: existing.id },
        data: banner,
      });
    } else {
      await prisma.heroBanner.create({ data: banner });
    }
  }
  console.log(`Seeded ${banners.length} hero banners`);
}

async function seedSystemConfig() {
  const defaults: Array<{
    key: string;
    value: string;
    type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
    category: "PRICING" | "SCHEDULE" | "TOURNAMENT" | "FEATURE_FLAG";
    label: string;
  }> = [
    { key: "MAX_ENTRY_FEE", value: "50", type: "NUMBER", category: "PRICING", label: "Max Entry Fee (NPR)" },
    { key: "MIN_ENTRY_FEE", value: "10", type: "NUMBER", category: "PRICING", label: "Min Entry Fee (NPR)" },
    { key: "SYSTEM_FEE_PERCENT", value: "20", type: "NUMBER", category: "PRICING", label: "Platform Cut %" },
    { key: "MIN_DEPOSIT_AMOUNT_NPR", value: "20", type: "NUMBER", category: "PRICING", label: "Minimum Deposit Amount (NPR)" },
    { key: "MIN_WITHDRAWAL_AMOUNT_NPR", value: "100", type: "NUMBER", category: "PRICING", label: "Minimum Withdrawal Amount (NPR)" },
    { key: "KILL_REWARD_PERCENT", value: "80", type: "NUMBER", category: "PRICING", label: "Kill+Booyah Pool %" },
    { key: "BOOYAH_COINS_PER_PLAYER", value: "1", type: "NUMBER", category: "PRICING", label: "Booyah Coins / Player" },
    { key: "MIN_PLAYERS_TO_START", value: "10", type: "NUMBER", category: "PRICING", label: "Min Players to Start" },
    { key: "FREE_DAILY_PRIZE_POOL", value: "100", type: "NUMBER", category: "PRICING", label: "Free Daily Prize Pool" },
    { key: "PRIZE_POOL_NOTE", value: "Prize pool scales with actual players. Entry fee is your only risk.", type: "STRING", category: "PRICING", label: "Pool Disclaimer" },
    { key: "HEADSHOT_RATE_LIMIT", value: "70", type: "NUMBER", category: "TOURNAMENT", label: "Default Max Headshot Rate %" },
    { key: "MIN_LEVEL_REQUIRED", value: "40", type: "NUMBER", category: "TOURNAMENT", label: "Default Min FF Level" },
    { key: "FREE_DAILY_COOLDOWN_HOURS", value: "24", type: "NUMBER", category: "SCHEDULE", label: "Free Daily Cooldown (hrs)" },
    { key: "FREE_DAILY_MAX_PER_DAY", value: "1", type: "NUMBER", category: "SCHEDULE", label: "Free Daily Max / day" },
    { key: "KILL_RACE_ENABLED", value: "true", type: "BOOLEAN", category: "TOURNAMENT", label: "Kill Race Enabled" },
    {
      key: "DEFAULT_PRIZE_SPLITS",
      value: '{"SOLO_TOP3":[50,30,20],"SQUAD_TOP10":[25,18,12,8,8,3,3,3,3,3]}',
      type: "JSON",
      category: "TOURNAMENT",
      label: "Default Prize Splits",
    },
    { key: "MAINTENANCE_MODE", value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Maintenance Mode" },
    { key: "NEW_USER_BONUS_ENABLED", value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "New User Bonus Enabled" },
    { key: "NEW_USER_BONUS_AMOUNT", value: "50", type: "NUMBER", category: "FEATURE_FLAG", label: "New User Bonus (NPR)" },
    { key: "APP_MAINTENANCE_ENABLED", value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "App Maintenance Enabled" },
    { key: "APP_MAINTENANCE_MESSAGE", value: "FireSlot Nepal is updating. Please try again soon.", type: "STRING", category: "FEATURE_FLAG", label: "App Maintenance Message" },
    { key: "APP_ANNOUNCEMENT_ACTIVE", value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Announcement Active" },
    { key: "APP_ANNOUNCEMENT_TEXT", value: "", type: "STRING", category: "FEATURE_FLAG", label: "Announcement Text" },
    { key: "APP_ANNOUNCEMENT_COLOR", value: "#E53935", type: "STRING", category: "FEATURE_FLAG", label: "Announcement Color" },
    { key: "APP_FORCE_UPDATE_ENABLED", value: "false", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Force Android Update" },
    { key: "APP_MIN_ANDROID_VERSION", value: "1.0.0", type: "STRING", category: "FEATURE_FLAG", label: "Minimum Android App Version" },
    { key: "APP_LATEST_VERSION", value: "1.0.0", type: "STRING", category: "FEATURE_FLAG", label: "Fallback Latest App Version" },
    { key: "APP_API_URL", value: "", type: "STRING", category: "FEATURE_FLAG", label: "Public API URL" },
    { key: "APP_PUBLIC_WEB_URL", value: "", type: "STRING", category: "FEATURE_FLAG", label: "Public Web URL" },
    { key: "APP_DOWNLOAD_ENABLED", value: "true", type: "BOOLEAN", category: "FEATURE_FLAG", label: "APK Download Enabled" },
    { key: "APP_SUPPORT_URL", value: "/support", type: "STRING", category: "FEATURE_FLAG", label: "App Support URL" },
    { key: "REFERRAL_ENABLED", value: "true", type: "BOOLEAN", category: "FEATURE_FLAG", label: "Referral Program Enabled" },
    { key: "REFERRAL_SIGNUP_REWARD_NPR", value: "10", type: "NUMBER", category: "FEATURE_FLAG", label: "Referral Signup Bonus (NPR)" },
    { key: "REFERRAL_FIRST_DEPOSIT_REWARD_NPR", value: "10", type: "NUMBER", category: "FEATURE_FLAG", label: "Referrer First Deposit Reward (NPR)" },
  ];

  for (const c of defaults) {
    const existing = await prisma.systemConfig.findUnique({ where: { key: c.key } });
    if (existing) continue;
    await prisma.systemConfig.create({ data: c });
  }
  console.log(`Seeded ${defaults.length} system config keys`);
}

async function seedRolesAndSuperAdmin() {
  const roleSpec: Record<string, { isSystem: boolean; permissions: Array<{ resource: string; action: string }> }> = {
    SUPER_ADMIN: { isSystem: true, permissions: [{ resource: "*", action: "*" }] },
    ADMIN: {
      isSystem: true,
      permissions: [
        ...["read", "write", "approve", "delete"].map((action) => ({ resource: "tournaments", action })),
        ...["read", "approve"].map((action) => ({ resource: "payments", action })),
        ...["read", "write", "ban"].map((action) => ({ resource: "users", action })),
        ...["read", "approve"].map((action) => ({ resource: "withdrawals", action })),
        ...["read", "approve"].map((action) => ({ resource: "results", action })),
        ...["read", "write"].map((action) => ({ resource: "config", action })),
        { resource: "reports", action: "read" },
        ...["read", "write"].map((action) => ({ resource: "finance", action })),
        { resource: "support", action: "read" },
        { resource: "support", action: "write" },
        { resource: "support", action: "approve" },
        { resource: "challenges", action: "read" },
        { resource: "challenges", action: "write" },
        { resource: "referrals", action: "read" },
        { resource: "referrals", action: "write" },
        { resource: "config", action: "toggle" },
      ],
    },
    MODERATOR: {
      isSystem: true,
      permissions: [
        { resource: "tournaments", action: "read" },
        { resource: "tournaments", action: "write" },
        { resource: "tournaments", action: "approve" },
        { resource: "results", action: "read" },
        { resource: "results", action: "approve" },
        { resource: "users", action: "read" },
        { resource: "users", action: "ban" },
        { resource: "support", action: "read" },
        { resource: "support", action: "write" },
        { resource: "support", action: "approve" },
        { resource: "referrals", action: "read" },
      ],
    },
    FINANCE: {
      isSystem: true,
      permissions: [
        { resource: "payments", action: "read" },
        { resource: "payments", action: "approve" },
        { resource: "payments", action: "adjust" },
        { resource: "withdrawals", action: "read" },
        { resource: "withdrawals", action: "approve" },
        { resource: "support", action: "read" },
      ],
    },
    SUPPORT: {
      isSystem: true,
      permissions: [
        { resource: "support", action: "read" },
        { resource: "support", action: "write" },
        { resource: "support", action: "approve" },
        { resource: "users", action: "read" },
        { resource: "payments", action: "read" },
        { resource: "tournaments", action: "read" },
        { resource: "challenges", action: "read" },
      ],
    },
    TOURNAMENT_HANDLER: {
      isSystem: true,
      permissions: [
        { resource: "tournaments", action: "read" },
        { resource: "tournaments", action: "write" },
        { resource: "tournaments", action: "approve" },
        { resource: "results", action: "read" },
        { resource: "results", action: "approve" },
        { resource: "challenges", action: "read" },
        { resource: "challenges", action: "write" },
      ],
    },
    PLAYER: { isSystem: true, permissions: [] },
  };

  const created: Record<string, string> = {};
  for (const [name, spec] of Object.entries(roleSpec)) {
    const role = await prisma.userRole.upsert({
      where: { name },
      update: { isSystem: spec.isSystem },
      create: { name, isSystem: spec.isSystem },
    });
    created[name] = role.id;
    await prisma.permission.deleteMany({ where: { roleId: role.id } });
    if (spec.permissions.length) {
      await prisma.permission.createMany({
        data: spec.permissions.map((p) => ({ ...p, roleId: role.id })),
      });
    }
  }
  console.log("Seeded roles:", Object.keys(created).join(", "));

  const superAdminEmail = "bhattaraiashok101@gmail.com";
  const superRoleId = created.SUPER_ADMIN;
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fireslot.np";
  if (adminEmail.toLowerCase() !== superAdminEmail) {
    await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { roleId: created.ADMIN, role: Role.ADMIN, isBanned: false },
    });
  }

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { roleId: superRoleId, isBanned: false, role: Role.SUPER_ADMIN },
    create: {
      email: superAdminEmail,
      name: "Ashok Bhattarai",
      role: Role.SUPER_ADMIN,
      roleId: superRoleId,
      wallet: { create: {} },
    },
  });
  console.log("Super admin ensured:", superAdminEmail);
}

async function seedFeatureFlags() {
  const flags: Array<{ key: string; label: string; group: string; enabled: boolean; description?: string }> = [
    { key: "TOURNAMENT_JOIN_ENABLED", label: "Tournament Joins", group: "TOURNAMENTS", enabled: true, description: "Allow players to join tournaments" },
    { key: "TOURNAMENT_CREATE_ENABLED", label: "Tournament Creation", group: "TOURNAMENTS", enabled: true, description: "Allow admin to create tournaments" },
    { key: "FREE_DAILY_ENABLED", label: "Free Daily Match", group: "TOURNAMENTS", enabled: true, description: "Enable free daily tournament" },
    { key: "CHALLENGE_ENABLED", label: "Challenges", group: "CHALLENGES", enabled: true, description: "Allow players to join challenges" },
    { key: "CHALLENGE_CREATE_ENABLED", label: "Challenge Creation", group: "CHALLENGES", enabled: true, description: "Allow players to create challenges" },
    { key: "DEPOSIT_ENABLED", label: "Deposits", group: "PAYMENTS", enabled: true, description: "Allow deposits" },
    { key: "WITHDRAWAL_ENABLED", label: "Withdrawals", group: "PAYMENTS", enabled: true, description: "Allow withdrawal requests" },
    { key: "PAYMENT_PROOF_ENABLED", label: "Payment Proof Upload", group: "PAYMENTS", enabled: true, description: "Allow payment proof submissions" },
    { key: "SUPPORT_ENABLED", label: "Support Tickets", group: "SUPPORT", enabled: true, description: "Allow support ticket creation" },
    { key: "REFERRAL_ENABLED", label: "Refer & Earn", group: "SYSTEM", enabled: true, description: "Allow referral signup and first-deposit rewards" },
    { key: "PUSH_NOTIFICATIONS_ENABLED", label: "Push Notifications", group: "NOTIFICATIONS", enabled: true, description: "Send push notifications" },
    { key: "LEADERBOARD_ENABLED", label: "Leaderboard", group: "SYSTEM", enabled: true, description: "Show leaderboard" },
    { key: "REGISTRATION_ENABLED", label: "New Registrations", group: "SYSTEM", enabled: true, description: "Allow new user registrations" },
    { key: "MAINTENANCE_MODE", label: "Maintenance Mode", group: "SYSTEM", enabled: false, description: "Show maintenance screen to all users" },
  ];

  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { label: f.label, group: f.group, description: f.description },
      create: f,
    });
  }
  console.log(`Seeded ${flags.length} feature flags`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
