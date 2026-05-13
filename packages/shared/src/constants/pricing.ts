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

// Percentage splits (sum to 100). SQUAD_TOP10 applies to the net pool after the
// 10% platform cut; other splits apply directly to the prize pool.
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
  const fee = Math.max(MIN_SYSTEM_FEE, Math.floor((entryFee * SYSTEM_FEE_PERCENT) / 100));
  return Math.max(0, entryFee - fee);
}

export function calculateSystemFee(entryFee: number): number {
  if (!entryFee || entryFee <= 0) return 0;
  return Math.max(MIN_SYSTEM_FEE, Math.floor((entryFee * SYSTEM_FEE_PERCENT) / 100));
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
