"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_MODE_LIMITS = exports.withdrawalSchema = exports.challengeCreateSchema = exports.tournamentCreateSchema = exports.profileSchema = exports.loginSchema = exports.registerSchema = exports.GameModeMaxTeams = exports.GameModeTeamSize = exports.GameModeLabels = exports.GameModes = exports.SQUAD_TOP10_PLATFORM_CUT_PERCENT = exports.PRIZE_SPLITS = exports.TournamentTypeLabels = exports.TournamentTypes = exports.FREE_DAILY_PRIZE_POOL = exports.MAX_ENTRY_FEE = exports.MIN_SYSTEM_FEE = exports.SYSTEM_FEE_PERCENT = void 0;
exports.calculateKillPrize = calculateKillPrize;
exports.calculateSystemFee = calculateSystemFee;
exports.getDefaultTournamentType = getDefaultTournamentType;
exports.isWinnerTakesAllOnly = isWinnerTakesAllOnly;
exports.calculatePrize = calculatePrize;
exports.validateTournamentCreation = validateTournamentCreation;
exports.formatSlots = formatSlots;
const zod_1 = require("zod");
exports.SYSTEM_FEE_PERCENT = 25;
exports.MIN_SYSTEM_FEE = 5;
exports.MAX_ENTRY_FEE = 50;
exports.FREE_DAILY_PRIZE_POOL = 100;
exports.TournamentTypes = [
    "FREE_DAILY",
    "SOLO_1ST",
    "SOLO_TOP3",
    "SQUAD_TOP10",
    "KILL_RACE",
    "COMBO",
];
exports.TournamentTypeLabels = {
    FREE_DAILY: "Free Daily",
    SOLO_1ST: "Solo Winner Takes All",
    SOLO_TOP3: "Solo Top 3",
    SQUAD_TOP10: "Squad Top 10",
    KILL_RACE: "Kill Race",
    COMBO: "Combo (Placement + Kills)",
};
exports.PRIZE_SPLITS = {
    FREE_DAILY: [100],
    SOLO_1ST: [100],
    SOLO_TOP3: [50, 30, 20],
    SQUAD_TOP10: [25, 18, 12, 8, 8, 3, 3, 3, 3, 3],
    KILL_RACE: [],
    COMBO: [60],
};
exports.SQUAD_TOP10_PLATFORM_CUT_PERCENT = 10;
function calculateKillPrize(entryFee) {
    if (!entryFee || entryFee <= 0)
        return 0;
    const fee = Math.max(exports.MIN_SYSTEM_FEE, Math.floor((entryFee * exports.SYSTEM_FEE_PERCENT) / 100));
    return Math.max(0, entryFee - fee);
}
function calculateSystemFee(entryFee) {
    if (!entryFee || entryFee <= 0)
        return 0;
    return Math.max(exports.MIN_SYSTEM_FEE, Math.floor((entryFee * exports.SYSTEM_FEE_PERCENT) / 100));
}
exports.GameModes = [
    "BR_SOLO",
    "BR_DUO",
    "BR_SQUAD",
    "CS_4V4",
    "LW_1V1",
    "LW_2V2",
    "CRAFTLAND",
];
exports.GameModeLabels = {
    BR_SOLO: "Battle Royale Solo",
    BR_DUO: "Battle Royale Duo",
    BR_SQUAD: "Battle Royale Squad",
    CS_4V4: "Clash Squad 4v4",
    LW_1V1: "Lone Wolf 1v1",
    LW_2V2: "Lone Wolf 2v2",
    CRAFTLAND: "Custom / Craftland",
};
exports.GameModeTeamSize = {
    BR_SOLO: 1,
    BR_DUO: 2,
    BR_SQUAD: 4,
    CS_4V4: 4, // 4v4 means teams of 4
    LW_1V1: 1,
    LW_2V2: 2,
    CRAFTLAND: 1, // Default to 1 for custom
};
exports.GameModeMaxTeams = {
    BR_SOLO: 48, // 48 individual players
    BR_DUO: 24, // 24 pairs = 48 players
    BR_SQUAD: 12, // 12 squads = 48 players
    CS_4V4: 2, // 2 teams of 4 = 8 players
    LW_1V1: 2, // 2 players
    LW_2V2: 2, // 2 teams of 2 = 4 players
    CRAFTLAND: 50,
};
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(7).optional(),
    password: zod_1.z.string().min(6),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.profileSchema = zod_1.z.object({
    freeFireUid: zod_1.z.string().min(4),
    ign: zod_1.z.string().min(2),
    level: zod_1.z.number().int().min(1).max(100),
    region: zod_1.z.string().optional(),
});
exports.tournamentCreateSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().optional(),
    mode: zod_1.z.enum(exports.GameModes),
    map: zod_1.z.string().optional(),
    entryFeeNpr: zod_1.z
        .number()
        .int()
        .min(20)
        .max(50)
        .refine((n) => n % 5 === 0, "Player fee must be NPR 20-50 and a multiple of 5"),
    registrationFeeNpr: zod_1.z
        .number()
        .int()
        .min(10)
        .max(15)
        .refine((n) => n % 5 === 0, "Registration fee must be 10 or 15")
        .default(10),
    prizePoolNpr: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "Prize pool must be a multiple of 5"),
    perKillPrizeNpr: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "Per-kill prize must be a multiple of 5")
        .default(0),
    firstPrize: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "1st prize must be a multiple of 5")
        .default(0),
    secondPrize: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "2nd prize must be a multiple of 5")
        .default(0),
    thirdPrize: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "3rd prize must be a multiple of 5")
        .default(0),
    fourthToTenthPrize: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "4th-10th prize must be a multiple of 5")
        .default(0),
    maxSlots: zod_1.z.number().int().min(2),
    dateTime: zod_1.z.string(),
    rules: zod_1.z.string().optional(),
    roomId: zod_1.z.string().optional(),
    roomPassword: zod_1.z.string().optional(),
})
    .refine((data) => data.registrationFeeNpr <= data.entryFeeNpr, {
    message: "Registration fee must be included inside the player fee",
    path: ["registrationFeeNpr"],
});
exports.challengeCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    mode: zod_1.z.enum(exports.GameModes),
    entryFeeNpr: zod_1.z
        .number()
        .int()
        .min(20)
        .max(50)
        .refine((n) => n % 5 === 0, "Entry fee must be NPR 20-50 and a multiple of 5"),
    prizeAmountNpr: zod_1.z
        .number()
        .int()
        .min(0)
        .refine((n) => n % 5 === 0, "Prize must be a multiple of 5"),
    maxPlayers: zod_1.z.number().int().min(2),
    opponentType: zod_1.z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});
exports.withdrawalSchema = zod_1.z.object({
    amountNpr: zod_1.z.number().int().min(100),
    method: zod_1.z.enum(["esewa", "khalti", "bank"]),
    account: zod_1.z.string().min(3),
});
// ─── Prize Calculation ────────────────────────────────────────────────────────
exports.GAME_MODE_LIMITS = {
    BR_SOLO: { teamSize: 1, maxTeams: 48, maxPlayers: 48 },
    BR_DUO: { teamSize: 2, maxTeams: 24, maxPlayers: 48 },
    BR_SQUAD: { teamSize: 4, maxTeams: 12, maxPlayers: 48 },
    CS_4V4: { teamSize: 4, maxTeams: 2, maxPlayers: 8 },
    LW_1V1: { teamSize: 1, maxTeams: 2, maxPlayers: 2 },
    LW_2V2: { teamSize: 2, maxTeams: 2, maxPlayers: 4 },
    CRAFTLAND: { teamSize: 1, maxTeams: 50, maxPlayers: 50 },
};
function getDefaultTournamentType(mode) {
    if (mode.startsWith("CS_") || mode.startsWith("LW_"))
        return "SOLO_1ST";
    if (mode === "BR_SQUAD" || mode === "BR_DUO")
        return "SQUAD_TOP10";
    if (mode === "BR_SOLO")
        return "SOLO_TOP3";
    return "SOLO_1ST";
}
function isWinnerTakesAllOnly(mode) {
    return mode.startsWith("CS_") || mode.startsWith("LW_");
}
function calculatePrize(params) {
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
    let prizeBreakdown = [];
    const isWTA = tournamentType === "SOLO_1ST" || isWinnerTakesAllOnly(tournamentType);
    if (isWTA) {
        prizeBreakdown = [{ rank: "1st Place", amount: netPool, percent: 100 }];
    }
    else if (tournamentType === "SOLO_TOP3") {
        prizeBreakdown = [
            { rank: "1st", amount: Math.floor(netPool * 0.5), percent: 50 },
            { rank: "2nd", amount: Math.floor(netPool * 0.3), percent: 30 },
            { rank: "3rd", amount: Math.floor(netPool * 0.2), percent: 20 },
        ];
    }
    else if (tournamentType === "SQUAD_TOP10") {
        const splits = [0.25, 0.18, 0.12, 0.08, 0.08, 0.05, 0.05, 0.05, 0.05, 0.05];
        const pool90 = Math.floor(netPool * 0.9);
        prizeBreakdown = splits.map((s, i) => ({ rank: `#${i + 1}`, amount: Math.floor(pool90 * s), percent: Math.round(s * 100) })).filter((p) => p.amount > 0);
    }
    else if (tournamentType === "KILL_RACE") {
        prizeBreakdown = [{ rank: "Per Kill", amount: perKillReward, percent: 0 }];
    }
    else if (tournamentType === "COMBO") {
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
function validateTournamentCreation(params) {
    const limits = exports.GAME_MODE_LIMITS[params.gameMode];
    if (!limits)
        return { valid: false, error: "Invalid game mode" };
    if (params.maxPlayers > limits.maxPlayers)
        return { valid: false, error: `${params.gameMode} supports max ${limits.maxPlayers} players` };
    if (params.maxPlayers % limits.teamSize !== 0)
        return { valid: false, error: `Player count must be divisible by team size (${limits.teamSize})` };
    if (params.entryFee < 0)
        return { valid: false, error: "Entry fee cannot be negative" };
    if (params.entryFee > 50)
        return { valid: false, error: "Entry fee cannot exceed Rs 50" };
    if (isWinnerTakesAllOnly(params.gameMode) && params.tournamentType !== "SOLO_1ST")
        return { valid: false, error: "CS and Lone Wolf tournaments must be Winner Takes All" };
    return { valid: true };
}
function formatSlots(mode, filledSlots, maxPlayers) {
    const limits = exports.GAME_MODE_LIMITS[mode];
    if (!limits || limits.teamSize === 1)
        return `${filledSlots}/${maxPlayers} players`;
    const filledTeams = Math.floor(filledSlots / limits.teamSize);
    const maxTeams = Math.floor(maxPlayers / limits.teamSize);
    return `${filledTeams}/${maxTeams} teams`;
}
