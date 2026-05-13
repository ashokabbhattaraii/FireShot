import type { MemoryCacheService } from "../../common/cache/memory-cache.service";

export const TOURNAMENT_LIST_CACHE_PREFIX = "tournaments:list:";
export const TOURNAMENT_DETAIL_CACHE_PREFIX = "tournaments:detail:";

export function tournamentDetailCacheKey(tournamentId: string) {
  return `${TOURNAMENT_DETAIL_CACHE_PREFIX}${tournamentId}`;
}

export function invalidateTournamentCaches(
  cache: Pick<MemoryCacheService, "del" | "delPrefix">,
  tournamentId?: string | null,
) {
  cache.delPrefix(TOURNAMENT_LIST_CACHE_PREFIX);
  if (tournamentId) cache.del(tournamentDetailCacheKey(tournamentId));
  else cache.delPrefix(TOURNAMENT_DETAIL_CACHE_PREFIX);
}
