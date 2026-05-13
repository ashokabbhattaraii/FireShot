import { z } from "zod";


export const SYSTEM_FEE_PERCENT = 25;
export const MIN_SYSTEM_FEE = 5;
export const MAX_ENTRY_FEE = 50;
export const FREE_DAILY_PRIZE_POOL = 100;

export const TournamentTypes = [
  "FREE_DAILY",
  "SOLO_1ST",
  "SOLO_TOP3",
  "SQUAD_TOP10",
  "KILL_RACE",
  "COMBO",
] as const;
export type TournamentType = (typeof TournamentTypes)[number];

export const TournamentTypeLabels: Record<TournamentType, string> = {
  FREE_DAILY: "Free Daily",
  SOLO_1ST: "Solo Winner Takes All",
  SOLO_TOP3: "Solo Top 3",
  SQUAD_TOP10: "Squad Top 10",
  KILL_RACE: "Kill Race",
  COMBO: "Combo (Placement + Kills)",
};

export const PRIZE_SPLITS: Record<TournamentType, number[]> = {
  FREE_DAILY: [100],
  SOLO_1ST: [100],
  SOLO_TOP3: [50, 30, 20],
  SQUAD_TOP10: [25, 18, 12, 8, 8, 3, 3, 3, 3, 3],
  KILL_RACE: [],
  COMBO: [60],
};

export const SQUAD_TOP10_PLATFORM_CUT_PERCENT = 10;

export function calculateKillPrize(entryFee: number): number {
  if (!entryFee || entryFee <= 0) return 0;
  const fee = Math.max(
    MIN_SYSTEM_FEE,
    Math.floor((entryFee * SYSTEM_FEE_PERCENT) / 100),
  );
  return Math.max(0, entryFee - fee);
}

export function calculateSystemFee(entryFee: number): number {
  if (!entryFee || entryFee <= 0) return 0;
  return Math.max(
    MIN_SYSTEM_FEE,
    Math.floor((entryFee * SYSTEM_FEE_PERCENT) / 100),
  );
}

export interface PrizeRankEntry {
  rank: number | string;
  percent: number;
  amount: number;
}

export interface PrizeStructure {
  type: TournamentType;
  pool: number;
  netPool: number;
  platformCut: number;
  perKillPrize: number;
  systemFeePerKill: number;
  placement: PrizeRankEntry[];
  killBonusPool?: number;
  notes?: string;
}

export const GameModes = [
  "BR_SOLO",
  "BR_DUO",
  "BR_SQUAD",
  "CS_4V4",
  "LW_1V1",
  "LW_2V2",
  "CRAFTLAND",
] as const;
export type GameMode = (typeof GameModes)[number];

export const GameModeLabels: Record<GameMode, string> = {
  BR_SOLO: "Battle Royale Solo",
  BR_DUO: "Battle Royale Duo",
  BR_SQUAD: "Battle Royale Squad",
  CS_4V4: "Clash Squad 4v4",
  LW_1V1: "Lone Wolf 1v1",
  LW_2V2: "Lone Wolf 2v2",
  CRAFTLAND: "Custom / Craftland",
};

export const GameModeTeamSize: Record<GameMode, number> = {
  BR_SOLO: 1,
  BR_DUO: 2,
  BR_SQUAD: 4,
  CS_4V4: 4, // 4v4 means teams of 4
  LW_1V1: 1,
  LW_2V2: 2,
  CRAFTLAND: 1, // Default to 1 for custom
};

export const GameModeMaxTeams: Record<GameMode, number> = {
  BR_SOLO: 48, // 48 individual players
  BR_DUO: 24,  // 24 pairs = 48 players
  BR_SQUAD: 12, // 12 squads = 48 players
  CS_4V4: 2,   // 2 teams of 4 = 8 players
  LW_1V1: 2,   // 2 players
  LW_2V2: 2,   // 2 teams of 2 = 4 players
  CRAFTLAND: 50,
};

export const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).optional(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const profileSchema = z.object({
  freeFireUid: z.string().min(4),
  ign: z.string().min(2),
  level: z.number().int().min(1).max(100),
  region: z.string().optional(),
});

export const tournamentCreateSchema = z
  .object({
    title: z.string().min(3),
    description: z.string().optional(),
    mode: z.enum(GameModes),
    map: z.string().optional(),
    entryFeeNpr: z
      .number()
      .int()
      .min(20)
      .max(50)
      .refine(
        (n) => n % 5 === 0,
        "Player fee must be NPR 20-50 and a multiple of 5",
      ),
    registrationFeeNpr: z
      .number()
      .int()
      .min(10)
      .max(15)
      .refine((n) => n % 5 === 0, "Registration fee must be 10 or 15")
      .default(10),
    prizePoolNpr: z
      .number()
      .int()
      .min(0)
      .refine((n) => n % 5 === 0, "Prize pool must be a multiple of 5"),
    perKillPrizeNpr: z
      .number()
      .int()
      .min(0)
      .refine((n) => n % 5 === 0, "Per-kill prize must be a multiple of 5")
      .default(0),
    firstPrize: z
      .number()
      .int()
      .min(0)
      .refine((n) => n % 5 === 0, "1st prize must be a multiple of 5")
      .default(0),
    secondPrize: z
      .number()
      .int()
      .min(0)
      .refine((n) => n % 5 === 0, "2nd prize must be a multiple of 5")
      .default(0),
    thirdPrize: z
      .number()
      .int()
      .min(0)
      .refine((n) => n % 5 === 0, "3rd prize must be a multiple of 5")
      .default(0),
    fourthToTenthPrize: z
      .number()
      .int()
      .min(0)
      .refine((n) => n % 5 === 0, "4th-10th prize must be a multiple of 5")
      .default(0),
    maxSlots: z.number().int().min(2),
    dateTime: z.string(),
    rules: z.string().optional(),
    roomId: z.string().optional(),
    roomPassword: z.string().optional(),
  })
  .refine((data) => data.registrationFeeNpr <= data.entryFeeNpr, {
    message: "Registration fee must be included inside the player fee",
    path: ["registrationFeeNpr"],
  });

export const challengeCreateSchema = z.object({
  title: z.string().min(3),
  mode: z.enum(GameModes),
  entryFeeNpr: z
    .number()
    .int()
    .min(20)
    .max(50)
    .refine(
      (n) => n % 5 === 0,
      "Entry fee must be NPR 20-50 and a multiple of 5",
    ),
  prizeAmountNpr: z
    .number()
    .int()
    .min(0)
    .refine((n) => n % 5 === 0, "Prize must be a multiple of 5"),
  maxPlayers: z.number().int().min(2),
  opponentType: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const withdrawalSchema = z.object({
  amountNpr: z.number().int().min(100),
  method: z.enum(["esewa", "khalti", "bank"]),
  account: z.string().min(3),
});

// ─── Prize Calculation ────────────────────────────────────────────────────────

export const GAME_MODE_LIMITS = {
  BR_SOLO: { teamSize: 1, maxTeams: 48, maxPlayers: 48 },
  BR_DUO: { teamSize: 2, maxTeams: 24, maxPlayers: 48 },
  BR_SQUAD: { teamSize: 4, maxTeams: 12, maxPlayers: 48 },
  CS_4V4: { teamSize: 4, maxTeams: 2, maxPlayers: 8 },
  LW_1V1: { teamSize: 1, maxTeams: 2, maxPlayers: 2 },
  LW_2V2: { teamSize: 2, maxTeams: 2, maxPlayers: 4 },
  CRAFTLAND: { teamSize: 1, maxTeams: 50, maxPlayers: 50 },
} as const;

export type PrizeGameMode = keyof typeof GAME_MODE_LIMITS;

export function getDefaultTournamentType(mode: string): string {
  if (mode.startsWith("CS_") || mode.startsWith("LW_")) return "SOLO_1ST";
  if (mode === "BR_SQUAD" || mode === "BR_DUO") return "SQUAD_TOP10";
  if (mode === "BR_SOLO") return "SOLO_TOP3";
  return "SOLO_1ST";
}

export function isWinnerTakesAllOnly(mode: string): boolean {
  return mode.startsWith("CS_") || mode.startsWith("LW_");
}

export interface PrizeResult {
  grossPool: number;
  platformFee: number;
  netPool: number;
  perKillReward: number;
  booyahPrize: number;
  prizeBreakdown: { rank: string; amount: number; percent: number }[];
  isEstimate: boolean;
  estimatedFor: number;
}

export function calculatePrize(params: {
  entryFee: number;
  playerCount: number;
  tournamentType: string;
  systemFeePercent?: number;
}): PrizeResult {
  const { entryFee, playerCount, tournamentType } = params;
  const feePercent = params.systemFeePercent ?? 0.20;

  if (playerCount === 0 || entryFee === 0) {
    return { grossPool: 0, platformFee: 0, netPool: 0, perKillReward: 0, booyahPrize: 0, prizeBreakdown: [], isEstimate: true, estimatedFor: 0 };
  }

  const grossPool = entryFee * playerCount;
  const platformFee = Math.floor(grossPool * feePercent);
  const netPool = grossPool - platformFee;

  const avgKills = playerCount <= 4 ? 1.5 : playerCount <= 12 ? 2.0 : 2.5;
  const killPool = Math.floor(netPool * 0.8);
  const perKillReward = Math.max(1, Math.floor(killPool / (playerCount * avgKills)));
  const booyahPrize = Math.max(1, playerCount);

  let prizeBreakdown: { rank: string; amount: number; percent: number }[] = [];
  const isWTA = tournamentType === "SOLO_1ST" || isWinnerTakesAllOnly(tournamentType);

  if (isWTA) {
    prizeBreakdown = [{ rank: "1st Place", amount: netPool, percent: 100 }];
  } else if (tournamentType === "SOLO_TOP3") {
    prizeBreakdown = [
      { rank: "1st", amount: Math.floor(netPool * 0.5), percent: 50 },
      { rank: "2nd", amount: Math.floor(netPool * 0.3), percent: 30 },
      { rank: "3rd", amount: Math.floor(netPool * 0.2), percent: 20 },
    ];
  } else if (tournamentType === "SQUAD_TOP10") {
    const splits = [0.25, 0.18, 0.12, 0.08, 0.08, 0.05, 0.05, 0.05, 0.05, 0.05];
    const pool90 = Math.floor(netPool * 0.9);
    prizeBreakdown = splits.map((s, i) => ({ rank: `#${i + 1}`, amount: Math.floor(pool90 * s), percent: Math.round(s * 100) })).filter((p) => p.amount > 0);
  } else if (tournamentType === "KILL_RACE") {
    prizeBreakdown = [{ rank: "Per Kill", amount: perKillReward, percent: 0 }];
  } else if (tournamentType === "COMBO") {
    const placementPool = Math.floor(netPool * 0.6);
    const killPoolCombo = Math.floor(netPool * 0.4);
    prizeBreakdown = [
      { rank: "1st Place", amount: Math.floor(placementPool * 0.5), percent: 30 },
      { rank: "2nd Place", amount: Math.floor(placementPool * 0.3), percent: 18 },
      { rank: "3rd Place", amount: Math.floor(placementPool * 0.2), percent: 12 },
      { rank: "Per Kill", amount: Math.floor(killPoolCombo / (playerCount * avgKills)), percent: 0 },
    ];
  }

  return { grossPool, platformFee, netPool, perKillReward, booyahPrize, prizeBreakdown, isEstimate: true, estimatedFor: playerCount };
}

export function validateTournamentCreation(params: {
  gameMode: string;
  tournamentType: string;
  entryFee: number;
  maxPlayers: number;
}): { valid: boolean; error?: string } {
  const limits = GAME_MODE_LIMITS[params.gameMode as PrizeGameMode];
  if (!limits) return { valid: false, error: "Invalid game mode" };
  if (params.maxPlayers > limits.maxPlayers) return { valid: false, error: `${params.gameMode} supports max ${limits.maxPlayers} players` };
  if (params.maxPlayers % limits.teamSize !== 0) return { valid: false, error: `Player count must be divisible by team size (${limits.teamSize})` };
  if (params.entryFee < 0) return { valid: false, error: "Entry fee cannot be negative" };
  if (params.entryFee > 50) return { valid: false, error: "Entry fee cannot exceed Rs 50" };
  if (isWinnerTakesAllOnly(params.gameMode) && params.tournamentType !== "SOLO_1ST") return { valid: false, error: "CS and Lone Wolf tournaments must be Winner Takes All" };
  return { valid: true };
}

export function formatSlots(mode: string, filledSlots: number, maxPlayers: number): string {
  const limits = GAME_MODE_LIMITS[mode as PrizeGameMode];
  if (!limits || limits.teamSize === 1) return `${filledSlots}/${maxPlayers} players`;
  const filledTeams = Math.floor(filledSlots / limits.teamSize);
  const maxTeams = Math.floor(maxPlayers / limits.teamSize);
  return `${filledTeams}/${maxTeams} teams`;
}
