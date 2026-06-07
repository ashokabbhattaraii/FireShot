"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Trophy, Users, Coins, ChevronDown, MapPin, Bomb } from "lucide-react";
import { fmtDate, npr } from "@/lib/utils";
import { calculatePrize, formatSlots, isWinnerTakesAllOnly, PRIZE_SPLITS, TournamentTypeLabels, type TournamentType } from "@fireslot/shared";
import { CardSkeleton, LoadingState, StatusBadge } from "@/components/ui";
import { useCategories } from "@/lib/categories-context";

type Tab = "ONGOING" | "UPCOMING" | "RESULTS";

export default function TournamentsListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [publicStats, setPublicStats] = useState<any | null>(null);
  // dummy/demo mode removed
  const [tab, setTab] = useState<Tab>("UPCOMING");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    setErr(null);
    api("/tournaments")
      .then(setItems)
      .catch((e: any) => setErr(e.message ?? "Could not load matches"))
      .finally(() => setLoading(false));
    // fetch public stats
    api("/app/stats").then((s) => setPublicStats(s)).catch(() => setPublicStats(null));
  }, []);

  const filtered = useMemo(() => {
    // ONGOING: show LIVE only if the user has joined; otherwise fall back to UPCOMING ordered by time
    if (tab === "ONGOING") {
      const liveJoined = items.filter(
        (t) => (t.status === "LIVE" || t.status === "PENDING_RESULTS") && !!t.participants?.some((p: any) => p.userId === user?.id)
      );
      if (liveJoined.length > 0) return liveJoined;
      // fallback to upcoming ordered by datetime
      return items
        .filter((t) => t.status === "UPCOMING")
        .sort((a, b) => new Date(a.dateTime ?? a.createdAt ?? 0).getTime() - new Date(b.dateTime ?? b.createdAt ?? 0).getTime());
    }
    if (tab === "UPCOMING") {
      return items
        .filter((t) => t.status === "UPCOMING")
        .sort((a, b) => new Date(a.dateTime ?? a.createdAt ?? 0).getTime() - new Date(b.dateTime ?? b.createdAt ?? 0).getTime());
    }
    // RESULTS
    return items.filter((t) => t.status === "COMPLETED");
  }, [items, tab, user]);

  // dummy/demo mode removed (no fake-count ticking)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        {(["ONGOING", "UPCOMING", "RESULTS"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              tab === t ? "bg-neon text-black" : "bg-surface text-white/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-6 text-sm text-white/70">
        <div>Users: <span className="font-semibold text-white">{publicStats?.activeUsers ?? "-"}</span></div>
        <div>Downloads: <span className="font-semibold text-white">{publicStats?.totalDownloads ?? "-"}</span></div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : err ? (
        <LoadingState label={err} />
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-white/50">No matches in this tab</p>
      ) : (
        <div
          className="tournament-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((t) => (
            <TournamentRow
              key={t.id}
              t={t}
              expanded={!!expanded[t.id]}
              toggle={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentRow({
  t, expanded, toggle,
}: { t: any; expanded: boolean; toggle: () => void }) {
  const router = useRouter();
  const { thumbnailMap } = useCategories();
  const ps = useMemo(() => t.prizeStructure ?? {}, [t.prizeStructure]);
  const type = (t.type ?? "SOLO_1ST") as TournamentType;
  const isWTA = type === "SOLO_1ST" || isWinnerTakesAllOnly(t.mode ?? "");
  const isPlacementPrize = type === "SOLO_TOP3" || type === "SQUAD_TOP10";
  const isKillPrize = type === "KILL_RACE" || type === "COMBO";

  // Fix: never show 0 — compute client-side if backend returned 0
  const computed = useMemo(() => {
    const existingPerKill = t.perKillReward ?? ps.perKillReward ?? 0;
    if (existingPerKill > 0 || isWTA || isPlacementPrize) return null;
    return calculatePrize({
      entryFee: t.entryFeeNpr ?? 0,
      playerCount: t.maxSlots || 48,
      tournamentType: type,
    });
  }, [t, ps, isWTA, isPlacementPrize, type]);

  const perKill = isKillPrize ? computed?.perKillReward ?? t.perKillReward ?? ps.perKillReward ?? 0 : 0;
  const booyah = isKillPrize ? computed?.booyahPrize ?? t.booyahPrize ?? ps.booyahPrize ?? 0 : 0;
  const grossPool = computed?.grossPool ?? ps.grossPool ?? t.entryFeeNpr * t.maxSlots;
  const netPool = computed?.netPool ?? ps.netPool ?? grossPool;
  const rankPreview =
    ps.prizeBreakdown?.length
      ? ps.prizeBreakdown
      : (PRIZE_SPLITS[type] ?? []).map((percent: number, index: number) => ({
          rank: index === 0 ? "1st" : index === 1 ? "2nd" : index === 2 ? "3rd" : `#${index + 1}`,
          amount: Math.floor((netPool * percent) / 100),
          percent,
        }));
  const slotText = formatSlots(t.mode ?? "BR_SOLO", t.filledSlots ?? 0, t.maxSlots ?? 48);
  const canJoin = t.status === "UPCOMING" && (t.filledSlots ?? 0) < (t.maxSlots ?? 0);
  const isResult = t.status === "COMPLETED" || t.status === "PENDING_RESULTS";

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/tournaments/${t.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/tournaments/${t.id}`);
      }}
      className="cursor-pointer rounded-2xl border border-border bg-gradient-to-br from-[#1a1233] via-[#0f0a26] to-[#1a1233] overflow-hidden transition hover:border-neon/50"
    >
      {(() => {
        const FALLBACK_COVERS: Record<string, string> = {
          BR: "/game-types/battle-royale.png",
          CS: "/game-types/clash-squad.png",
          LW: "/game-types/lone-wolf.png",
          CRAFTLAND: "/game-types/craftland.png",
        };
        const mode = (t.mode ?? "") as string;
        const prefix = mode.split("_")[0];
        const cover = t.coverUrl || thumbnailMap[mode] || thumbnailMap[prefix] || FALLBACK_COVERS[prefix] || FALLBACK_COVERS[mode];
        if (cover) return (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-32 w-full object-cover" />
        );
        return (
          <div className="h-24 w-full bg-gradient-to-r from-neon/30 via-neon-purple/20 to-neon-cyan/30 flex items-center justify-center">
            <Trophy className="text-white/40" size={36} />
          </div>
        );
      })()}

      <div className="p-3">
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-0.5 text-[10px] text-neon-cyan">
            {t.mode?.startsWith("BR_") ? t.mode.replace("BR_", "") : t.mode}
          </span>
          {t.map && (
            <span className="rounded-full border border-neon-purple/40 bg-neon-purple/10 px-2 py-0.5 text-[10px] text-neon-purple flex items-center gap-1">
              <MapPin size={10} /> {t.map}
            </span>
          )}
          <StatusBadge status={t.status} />
        </div>

        <h3 className="font-display text-lg text-white flex items-center gap-2">
          <Bomb size={16} className="text-neon-orange" /> {t.title}
        </h3>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-black/30 p-2">
          <Cell label="Date">
            <div className="text-xs text-white">{fmtDate(t.dateTime)}</div>
          </Cell>
          <button onClick={(e) => { e.stopPropagation(); toggle(); }} className="text-left">
            <Cell label={isWTA ? "WINNER GETS" : isPlacementPrize ? "TOP PRIZE" : "PRIZE POOL"}>
              <div className="flex items-center gap-1 text-neon font-bold text-sm">
                ~{npr(isPlacementPrize && rankPreview[0]?.amount ? rankPreview[0].amount : netPool)} <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
              </div>
            </Cell>
          </button>
          <Cell label={isWTA ? "MODE" : isPlacementPrize ? "PAYOUT" : isKillPrize ? "PER KILL" : "REWARD"}>
            <div className="text-neon-cyan font-bold text-sm">
              {isWTA ? "Winner Takes All" : isPlacementPrize ? TournamentTypeLabels[type] : isKillPrize ? npr(perKill) : npr(netPool)}
            </div>
          </Cell>
        </div>

        {isWTA && (
          <div className="mt-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-300">Winner Takes All</p>
            <p className="mt-1 text-lg font-black text-white">Win ~{npr(netPool)} in one match</p>
          </div>
        )}

        {isPlacementPrize && rankPreview.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {rankPreview.slice(0, 3).map((prize: any) => (
              <div key={prize.rank} className="rounded-lg border border-white/10 bg-black/25 p-2 text-center">
                <p className="text-[9px] uppercase text-white/50">{prize.rank}</p>
                <p className="text-xs font-bold text-yellow-300">{npr(prize.amount)}</p>
              </div>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-2 rounded-lg border border-border bg-black/40 p-3 text-xs text-white/80 space-y-1">
            <Row label="Gross Pool" value={npr(grossPool)} />
            <Row label={`Platform Fee (${ps.systemFeePercent ?? 20}%)`} value={`- ${npr(ps.platformCut ?? 0)}`} />
            <Row label="Net Pool" value={npr(ps.netPool ?? 0)} bold />
            {rankPreview.length > 0 && rankPreview.map((prize: any) => (
              <Row key={prize.rank} label={prize.rank} value={npr(prize.amount)} accent />
            ))}
            {isKillPrize && <Row label="Per Kill Reward" value={npr(perKill)} accent />}
            {isKillPrize && <Row label="Booyah Prize" value={npr(booyah)} accent />}
            <p className="mt-2 text-[10px] text-white/50">
              {ps.scalingNote ?? "Pool scales with actual players. Entry fee is your only risk."}
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-white/60 flex items-center gap-1">
            <Users size={12} /> {slotText}
          </span>
          <Link
            href={`/tournaments/${t.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-lg flex items-center gap-1 ${
              canJoin || isResult ? "bg-gradient-to-r from-rose-500 to-pink-500" : "border border-white/15 bg-white/10 text-white/70"
            }`}
          >
            <Coins size={12} /> {isResult ? "View Result" : canJoin ? `Rs ${t.entryFeeNpr} JOIN →` : t.status}
          </Link>
        </div>
      </div>
    </article>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-white/50">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      <span className={`${accent ? "text-neon-cyan" : "text-white"} ${bold ? "font-bold" : ""}`}>
        {value}
      </span>
    </div>
  );
}
