"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GameModeLabels,
  TournamentTypeLabels,
  calculatePrize,
  formatSlots,
  isWinnerTakesAllOnly,
  PRIZE_SPLITS,
  type TournamentType,
} from "@fireslot/shared";
import { fmtDate, npr } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Gift } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { useCategories } from "@/lib/categories-context";

const FALLBACK_COVERS: Record<string, string> = {
  BR: "/game-types/battle-royale.png",
  CS: "/game-types/clash-squad.png",
  LW: "/game-types/lone-wolf.png",
  CRAFTLAND: "/game-types/craftland.png",
};

export function TournamentCard({ t }: { t: any }) {
  const { thumbnailMap } = useCategories();
  const full = t.filledSlots >= t.maxSlots;
  const playerFee = t.entryFeeNpr;
  const type = (t.type ?? "SOLO_1ST") as TournamentType;
  const isFree = type === "FREE_DAILY";
  const modeLabel = GameModeLabels[t.mode as keyof typeof GameModeLabels] ?? t.mode;
  const isWTA = type === "SOLO_1ST" || isWinnerTakesAllOnly(t.mode ?? "");
  const isPlacementPrize = type === "SOLO_TOP3" || type === "SQUAD_TOP10";
  const isKillPrize = type === "KILL_RACE" || type === "COMBO";

  const displayPrize = useMemo(() => {
    const existingPerKill = t.killPrize ?? t.perKillReward ?? t.perKillPrizeNpr ?? 0;
    if (existingPerKill > 0 || isWTA || isPlacementPrize) {
      return {
        perKill: isKillPrize ? existingPerKill : 0,
        booyah: isKillPrize ? t.booyahPrize ?? 0 : 0,
        prizePool: t.prizeStructure?.netPool ?? t.firstPrize ?? t.prizePoolNpr ?? 0,
        breakdown: t.prizeStructure?.prizeBreakdown ?? [],
      };
    }
    const calc = calculatePrize({
      entryFee: playerFee,
      playerCount: t.maxSlots || 48,
      tournamentType: type,
    });
    return {
      perKill: calc.perKillReward,
      booyah: calc.booyahPrize,
      prizePool: calc.netPool,
      breakdown: calc.prizeBreakdown,
    };
  }, [t, playerFee, type, isWTA, isPlacementPrize, isKillPrize]);

  const perKill = displayPrize.perKill;
  const topPrize = displayPrize.prizePool || t.firstPrize || t.prizePoolNpr || 0;
  const rankPreview =
    displayPrize.breakdown?.length
      ? displayPrize.breakdown.slice(0, type === "SQUAD_TOP10" ? 3 : 10)
      : (PRIZE_SPLITS[type] ?? []).slice(0, type === "SQUAD_TOP10" ? 3 : 10).map((percent, index) => ({
          rank: index === 0 ? "1st" : index === 1 ? "2nd" : index === 2 ? "3rd" : `#${index + 1}`,
          amount: Math.floor((topPrize * percent) / 100),
          percent,
        }));
  const slotText = formatSlots(t.mode ?? "BR_SOLO", t.filledSlots ?? 0, t.maxSlots ?? 48);

  const { user } = useAuth();
  const [nextAt, setNextAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    if (!isFree || !user) return;
    api("/tournaments/free-daily/eligibility")
      .then((r: any) => setNextAt(r.eligible ? null : r.nextWindowAt ?? r.nextAvailableAt))
      .catch(() => {});
  }, [isFree, user]);

  useEffect(() => {
    if (!nextAt) return;
    const tick = () => {
      const ms = new Date(nextAt).getTime() - Date.now();
      if (ms <= 0) { setNextAt(null); setCountdown(""); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextAt]);

  const modeBadgeClass = t.mode?.startsWith("BR_") ? "fs-badge fs-badge-red"
    : t.mode?.startsWith("CS_") ? "fs-badge fs-badge-gold"
    : "fs-badge fs-badge-green";
  const canJoin = t.status === "UPCOMING" && !full && !(isFree && nextAt);
  const hasResults = t.status === "COMPLETED" || t.status === "PENDING_RESULTS";
  const router = useRouter();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/tournaments/${t.id}`);
    }
  };

  return (
    <div
      className="fs-card cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/tournaments/${t.id}`)}
      onKeyDown={handleKeyDown}
    >
      {(() => {
        const mode = (t.mode ?? "") as string;
        const prefix = mode.split("_")[0];
        const cover = t.coverUrl || thumbnailMap[mode] || thumbnailMap[prefix] || FALLBACK_COVERS[prefix] || FALLBACK_COVERS[mode];
        if (cover) return (
          <div className="relative">
            <img
              src={cover}
              alt=""
              className="w-full object-cover"
              style={{ height: '140px' }}
            />
            {t.status === "ONGOING" && (
              <span className="absolute top-3 right-3 fs-badge fs-badge-green flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--fs-green)] animate-pulse" />
                LIVE
              </span>
            )}
            {t.status === "COMPLETED" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="fs-badge fs-badge-gray text-sm">ENDED</span>
              </div>
            )}
          </div>
        );
        return (
          <div className="relative w-full flex items-center justify-center" style={{ height: '140px', background: 'linear-gradient(135deg, var(--fs-surface-2), var(--fs-surface-3))' }}>
            <span className="text-4xl opacity-30">🎮</span>
            {t.status === "ONGOING" && (
              <span className="absolute top-3 right-3 fs-badge fs-badge-green flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--fs-green)] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        );
      })()}

      <div className="fs-card-body">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={modeBadgeClass}>{modeLabel}</span>
          <span className="fs-badge fs-badge-gray">{t.map ?? TournamentTypeLabels[type]}</span>
          <StatusBadge status={t.status} />
          {isFree && (
            <span className="fs-badge fs-badge-green flex items-center gap-1">
              <Gift size={10} /> FREE
            </span>
          )}
        </div>

        <h3 className="mt-2 text-[15px] font-bold" style={{ color: 'var(--fs-text-1)' }}>
          💣 {t.title}
        </h3>

        <div className="mt-3 grid grid-cols-3 text-center" style={{ borderTop: '0.5px solid var(--fs-border)', borderBottom: '0.5px solid var(--fs-border)', padding: '10px 0' }}>
          <div style={{ borderRight: '0.5px solid var(--fs-border)' }}>
            <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--fs-text-3)' }}>Date</p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--fs-text-1)' }}>{fmtDate(t.dateTime)}</p>
          </div>
          <div style={{ borderRight: '0.5px solid var(--fs-border)' }}>
            <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--fs-text-3)' }}>
              {isWTA ? "Winner Gets" : isPlacementPrize ? "Top Prize" : "Prize Pool"}
            </p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--fs-text-1)' }}>
              {isFree ? "" : "~"}Rs {isPlacementPrize && rankPreview[0]?.amount ? rankPreview[0].amount : topPrize}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--fs-text-3)' }}>
              {isWTA ? "Mode" : isPlacementPrize ? "Payout" : isKillPrize ? "Per Kill" : "Reward"}
            </p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--fs-text-1)' }}>
              {isWTA ? "WTA" : isPlacementPrize ? TournamentTypeLabels[type] : isKillPrize ? `Rs ${perKill}` : `Rs ${topPrize}`}
            </p>
          </div>
        </div>

        {isWTA && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-center" style={{ borderColor: 'rgba(255,193,7,0.45)', background: 'rgba(255,193,7,0.1)' }}>
            <p className="text-[10px] uppercase font-bold tracking-[0.18em]" style={{ color: 'var(--fs-gold)' }}>Winner Takes All</p>
            <p className="mt-0.5 text-lg font-black" style={{ color: 'var(--fs-text-1)' }}>Win ~Rs {topPrize} in one match</p>
          </div>
        )}

        {isPlacementPrize && rankPreview.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {rankPreview.slice(0, 3).map((prize: any) => (
              <div key={prize.rank} className="rounded-lg px-2 py-2 text-center" style={{ background: 'var(--fs-surface-1)', border: '0.5px solid var(--fs-border)' }}>
                <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--fs-text-3)' }}>{prize.rank}</p>
                <p className="text-xs font-bold" style={{ color: 'var(--fs-gold)' }}>Rs {prize.amount}</p>
              </div>
            ))}
          </div>
        )}

        {isFree && nextAt && (
          <div className="mt-2 rounded-md px-3 py-2 text-xs font-medium" style={{ background: 'var(--fs-amber-dim)', color: 'var(--fs-amber)' }}>
            Next free slot in {countdown}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--fs-text-3)' }}>
            {slotText}
          </span>
          <Link
            href={`/tournaments/${t.id}`}
            className={`fs-btn fs-btn-sm ${
              canJoin || hasResults ? 'fs-btn-primary' : 'fs-btn-outline opacity-70'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {canJoin && !isFree && <span>🪙 Rs {playerFee}</span>}
            {hasResults ? "View Result" : full ? "Full" : isFree && nextAt ? "Used" : canJoin ? "JOIN →" : t.status}
          </Link>
        </div>
      </div>
    </div>
  );
}
