export declare const SYSTEM_FEE_PERCENT = 25;
export declare const MIN_SYSTEM_FEE = 5;
export declare const MAX_ENTRY_FEE = 50;
export declare const FREE_DAILY_PRIZE_POOL = 100;
export declare const TournamentTypes: readonly ["FREE_DAILY", "SOLO_1ST", "SOLO_TOP3", "SQUAD_TOP10", "KILL_RACE", "COMBO"];
export type TournamentType = (typeof TournamentTypes)[number];
export declare const TournamentTypeLabels: Record<TournamentType, string>;
export declare const PRIZE_SPLITS: Record<TournamentType, number[]>;
export declare const SQUAD_TOP10_PLATFORM_CUT_PERCENT = 10;
export declare function calculateKillPrize(entryFee: number): number;
export declare function calculateSystemFee(entryFee: number): number;
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
