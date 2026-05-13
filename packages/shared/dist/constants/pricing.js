"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQUAD_TOP10_PLATFORM_CUT_PERCENT = exports.PRIZE_SPLITS = exports.TournamentTypeLabels = exports.TournamentTypes = exports.FREE_DAILY_PRIZE_POOL = exports.MAX_ENTRY_FEE = exports.MIN_SYSTEM_FEE = exports.SYSTEM_FEE_PERCENT = void 0;
exports.calculateKillPrize = calculateKillPrize;
exports.calculateSystemFee = calculateSystemFee;
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
// Percentage splits (sum to 100). SQUAD_TOP10 applies to the net pool after the
// 10% platform cut; other splits apply directly to the prize pool.
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
