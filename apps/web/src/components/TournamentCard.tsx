"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  GameModeLabels,
  TournamentTypeLabels,
  calculateKillPrize,
  calculatePrize,
  formatSlots,
  GAME_MODE_LIMITS,
  isWinnerTakesAllOnly,
  type TournamentType,
  type PrizeGameMode,
} from "@fireslot/shared";
import { fmtDate, npr } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Gift } from "lucide-react";
import { StatusBadge } from "@/components/ui";

export function TournamentCard({ t }: { t: any }) {
  const full = t.filledSlots >= t.maxSlots;
  const playerFee = t.entryFeeNpr;
  const type = (t.type ?? "SOLO_1ST") as TournamentType;
  const isFree = type === "FREE_DAILY";
  const modeLabel = GameModeLabels[t.mode as keyof typeof GameModeLabels] ?? t.mode;
  const isWTA = isWinnerTakesAllOnly(t.mode ?? "");

  const displayPrize = useMemo(() => {
    const existingPerKill = t.killPrize ?? t.perKillReward ?? t.perKillPrizeNpr ?? 0;
    if (existingPerKill > 0 || isWTA) {
      return {
        perKill: existingPerKill,
        booyah: t.booyahPrize ?? 0,
        prizePool: t.prizeStructure?.netPool ?? t.firstPrize ?? t.prizePoolNpr ?? 0,
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
    };
  }, [t, playerFee, type, isWTA]);

  const perKill = displayPrize.perKill;
  const topPrize = displayPrize.prizePool || t.firstPrize || t.prizePoolNpr || 0;
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

  return (
    <div className="fs-card">
      {t.coverUrl ? (
        <div className="relative">
          <img
            src={t.coverUrl}
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
      ) : (
        <div className="relative w-full flex items-center justify-center" style={{ height: '140px', background: 'linear-gradient(135deg, var(--fs-surface-2), var(--fs-surface-3))' }}>
          <span className="text-4xl opacity-30">🎮</span>
          {t.status === "ONGOING" && (
            <span className="absolute top-3 right-3 fs-badge fs-badge-green flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--fs-green)] animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      )}

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
              {isWTA ? "Winner Gets" : "Prize Pool"}
            </p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--fs-text-1)' }}>
              {isFree ? "" : "~"}Rs {topPrize}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--fs-text-3)' }}>
              {isWTA ? "Mode" : "Per Kill"}
            </p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--fs-text-1)' }}>
              {isWTA ? "WTA" : `Rs ${perKill}`}
            </p>
          </div>
        </div>

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
              full || (isFree && nextAt) ? 'fs-btn-outline opacity-50 pointer-events-none' : 'fs-btn-primary'
            }`}
          >
            {!isFree && <span>🪙 Rs {playerFee}</span>}
            {full ? "Full" : isFree && nextAt ? "Used" : isFree ? "JOIN →" : "JOIN →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
