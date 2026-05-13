import { z } from "zod";
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
export declare const GameModes: readonly ["BR_SOLO", "BR_DUO", "BR_SQUAD", "CS_4V4", "LW_1V1", "LW_2V2", "CRAFTLAND"];
export type GameMode = (typeof GameModes)[number];
export declare const GameModeLabels: Record<GameMode, string>;
export declare const GameModeTeamSize: Record<GameMode, number>;
export declare const GameModeMaxTeams: Record<GameMode, number>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    phone?: string | undefined;
}, {
    email: string;
    password: string;
    phone?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const profileSchema: z.ZodObject<{
    freeFireUid: z.ZodString;
    ign: z.ZodString;
    level: z.ZodNumber;
    region: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    freeFireUid: string;
    ign: string;
    level: number;
    region?: string | undefined;
}, {
    freeFireUid: string;
    ign: string;
    level: number;
    region?: string | undefined;
}>;
export declare const tournamentCreateSchema: z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    mode: z.ZodEnum<["BR_SOLO", "BR_DUO", "BR_SQUAD", "CS_4V4", "LW_1V1", "LW_2V2", "CRAFTLAND"]>;
    map: z.ZodOptional<z.ZodString>;
    entryFeeNpr: z.ZodEffects<z.ZodNumber, number, number>;
    registrationFeeNpr: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    prizePoolNpr: z.ZodEffects<z.ZodNumber, number, number>;
    perKillPrizeNpr: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    firstPrize: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    secondPrize: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    thirdPrize: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    fourthToTenthPrize: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    maxSlots: z.ZodNumber;
    dateTime: z.ZodString;
    rules: z.ZodOptional<z.ZodString>;
    roomId: z.ZodOptional<z.ZodString>;
    roomPassword: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    mode: "BR_SOLO" | "BR_DUO" | "BR_SQUAD" | "CS_4V4" | "LW_1V1" | "LW_2V2" | "CRAFTLAND";
    entryFeeNpr: number;
    registrationFeeNpr: number;
    prizePoolNpr: number;
    perKillPrizeNpr: number;
    firstPrize: number;
    secondPrize: number;
    thirdPrize: number;
    fourthToTenthPrize: number;
    maxSlots: number;
    dateTime: string;
    map?: string | undefined;
    description?: string | undefined;
    rules?: string | undefined;
    roomId?: string | undefined;
    roomPassword?: string | undefined;
}, {
    title: string;
    mode: "BR_SOLO" | "BR_DUO" | "BR_SQUAD" | "CS_4V4" | "LW_1V1" | "LW_2V2" | "CRAFTLAND";
    entryFeeNpr: number;
    prizePoolNpr: number;
    maxSlots: number;
    dateTime: string;
    map?: string | undefined;
    description?: string | undefined;
    registrationFeeNpr?: number | undefined;
    perKillPrizeNpr?: number | undefined;
    firstPrize?: number | undefined;
    secondPrize?: number | undefined;
    thirdPrize?: number | undefined;
    fourthToTenthPrize?: number | undefined;
    rules?: string | undefined;
    roomId?: string | undefined;
    roomPassword?: string | undefined;
}>, {
    title: string;
    mode: "BR_SOLO" | "BR_DUO" | "BR_SQUAD" | "CS_4V4" | "LW_1V1" | "LW_2V2" | "CRAFTLAND";
    entryFeeNpr: number;
    registrationFeeNpr: number;
    prizePoolNpr: number;
    perKillPrizeNpr: number;
    firstPrize: number;
    secondPrize: number;
    thirdPrize: number;
    fourthToTenthPrize: number;
    maxSlots: number;
    dateTime: string;
    map?: string | undefined;
    description?: string | undefined;
    rules?: string | undefined;
    roomId?: string | undefined;
    roomPassword?: string | undefined;
}, {
    title: string;
    mode: "BR_SOLO" | "BR_DUO" | "BR_SQUAD" | "CS_4V4" | "LW_1V1" | "LW_2V2" | "CRAFTLAND";
    entryFeeNpr: number;
    prizePoolNpr: number;
    maxSlots: number;
    dateTime: string;
    map?: string | undefined;
    description?: string | undefined;
    registrationFeeNpr?: number | undefined;
    perKillPrizeNpr?: number | undefined;
    firstPrize?: number | undefined;
    secondPrize?: number | undefined;
    thirdPrize?: number | undefined;
    fourthToTenthPrize?: number | undefined;
    rules?: string | undefined;
    roomId?: string | undefined;
    roomPassword?: string | undefined;
}>;
export declare const challengeCreateSchema: z.ZodObject<{
    title: z.ZodString;
    mode: z.ZodEnum<["BR_SOLO", "BR_DUO", "BR_SQUAD", "CS_4V4", "LW_1V1", "LW_2V2", "CRAFTLAND"]>;
    entryFeeNpr: z.ZodEffects<z.ZodNumber, number, number>;
    prizeAmountNpr: z.ZodEffects<z.ZodNumber, number, number>;
    maxPlayers: z.ZodNumber;
    opponentType: z.ZodDefault<z.ZodEnum<["PUBLIC", "PRIVATE"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    mode: "BR_SOLO" | "BR_DUO" | "BR_SQUAD" | "CS_4V4" | "LW_1V1" | "LW_2V2" | "CRAFTLAND";
    entryFeeNpr: number;
    prizeAmountNpr: number;
    maxPlayers: number;
    opponentType: "PUBLIC" | "PRIVATE";
}, {
    title: string;
    mode: "BR_SOLO" | "BR_DUO" | "BR_SQUAD" | "CS_4V4" | "LW_1V1" | "LW_2V2" | "CRAFTLAND";
    entryFeeNpr: number;
    prizeAmountNpr: number;
    maxPlayers: number;
    opponentType?: "PUBLIC" | "PRIVATE" | undefined;
}>;
export declare const withdrawalSchema: z.ZodObject<{
    amountNpr: z.ZodNumber;
    method: z.ZodEnum<["esewa", "khalti", "bank"]>;
    account: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountNpr: number;
    method: "esewa" | "khalti" | "bank";
    account: string;
}, {
    amountNpr: number;
    method: "esewa" | "khalti" | "bank";
    account: string;
}>;
export declare const GAME_MODE_LIMITS: {
    readonly BR_SOLO: {
        readonly teamSize: 1;
        readonly maxTeams: 48;
        readonly maxPlayers: 48;
    };
    readonly BR_DUO: {
        readonly teamSize: 2;
        readonly maxTeams: 24;
        readonly maxPlayers: 48;
    };
    readonly BR_SQUAD: {
        readonly teamSize: 4;
        readonly maxTeams: 12;
        readonly maxPlayers: 48;
    };
    readonly CS_4V4: {
        readonly teamSize: 4;
        readonly maxTeams: 2;
        readonly maxPlayers: 8;
    };
    readonly LW_1V1: {
        readonly teamSize: 1;
        readonly maxTeams: 2;
        readonly maxPlayers: 2;
    };
    readonly LW_2V2: {
        readonly teamSize: 2;
        readonly maxTeams: 2;
        readonly maxPlayers: 4;
    };
    readonly CRAFTLAND: {
        readonly teamSize: 1;
        readonly maxTeams: 50;
        readonly maxPlayers: 50;
    };
};
export type PrizeGameMode = keyof typeof GAME_MODE_LIMITS;
export declare function getDefaultTournamentType(mode: string): string;
export declare function isWinnerTakesAllOnly(mode: string): boolean;
export interface PrizeResult {
    grossPool: number;
    platformFee: number;
    netPool: number;
    perKillReward: number;
    booyahPrize: number;
    prizeBreakdown: {
        rank: string;
        amount: number;
        percent: number;
    }[];
    isEstimate: boolean;
    estimatedFor: number;
}
export declare function calculatePrize(params: {
    entryFee: number;
    playerCount: number;
    tournamentType: string;
    systemFeePercent?: number;
}): PrizeResult;
export declare function validateTournamentCreation(params: {
    gameMode: string;
    tournamentType: string;
    entryFee: number;
    maxPlayers: number;
}): {
    valid: boolean;
    error?: string;
};
export declare function formatSlots(mode: string, filledSlots: number, maxPlayers: number): string;
