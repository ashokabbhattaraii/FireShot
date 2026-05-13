"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Trophy, Users, Coins, ChevronDown, MapPin, Bomb } from "lucide-react";
import { fmtDate, npr } from "@/lib/utils";
import { calculatePrize, formatSlots, isWinnerTakesAllOnly } from "@fireslot/shared";
import { CardSkeleton, LoadingState, StatusBadge } from "@/components/ui";

type Tab = "ONGOING" | "UPCOMING" | "RESULTS";

export default function TournamentsListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("UPCOMING");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    api("/tournaments")
      .then(setItems)
      .catch((e: any) => setErr(e.message ?? "Could not load matches"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (tab === "ONGOING") return t.status === "LIVE" || t.status === "PENDING_RESULTS";
      if (tab === "UPCOMING") return t.status === "UPCOMING";
      return t.status === "COMPLETED";
    });
  }, [items, tab]);

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
  const ps = t.prizeStructure ?? {};
  const isWTA = isWinnerTakesAllOnly(t.mode ?? "");

  // Fix: never show 0 — compute client-side if backend returned 0
  const computed = useMemo(() => {
    const existingPerKill = t.perKillReward ?? ps.perKillReward ?? 0;
    if (existingPerKill > 0 || isWTA) return null;
    return calculatePrize({
      entryFee: t.entryFeeNpr ?? 0,
      playerCount: t.maxSlots || 48,
      tournamentType: t.type ?? "SOLO_TOP3",
    });
  }, [t, ps, isWTA]);

  const perKill = computed?.perKillReward ?? t.perKillReward ?? ps.perKillReward ?? 0;
  const booyah = computed?.booyahPrize ?? t.booyahPrize ?? ps.booyahPrize ?? 0;
  const grossPool = computed?.grossPool ?? ps.grossPool ?? t.entryFeeNpr * t.maxSlots;
  const netPool = computed?.netPool ?? ps.netPool ?? grossPool;
  const slotText = formatSlots(t.mode ?? "BR_SOLO", t.filledSlots ?? 0, t.maxSlots ?? 48);

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-[#1a1233] via-[#0f0a26] to-[#1a1233] overflow-hidden">
      {t.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.coverUrl} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="h-24 w-full bg-gradient-to-r from-neon/30 via-neon-purple/20 to-neon-cyan/30 flex items-center justify-center">
          <Trophy className="text-white/40" size={36} />
        </div>
      )}

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
          <button onClick={toggle} className="text-left">
            <Cell label={isWTA ? "WINNER GETS" : "PRIZE POOL"}>
              <div className="flex items-center gap-1 text-neon font-bold text-sm">
                ~{npr(netPool)} <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
              </div>
            </Cell>
          </button>
          <Cell label={isWTA ? "MODE" : "PER KILL"}>
            <div className="text-neon-cyan font-bold text-sm">
              {isWTA ? "Winner Takes All" : npr(perKill)}
            </div>
          </Cell>
        </div>

        {expanded && (
          <div className="mt-2 rounded-lg border border-border bg-black/40 p-3 text-xs text-white/80 space-y-1">
            <Row label="Gross Pool" value={npr(grossPool)} />
            <Row label={`Platform Fee (${ps.systemFeePercent ?? 20}%)`} value={`- ${npr(ps.platformCut ?? 0)}`} />
            <Row label="Net Pool" value={npr(ps.netPool ?? 0)} bold />
            <Row label="Per Kill Reward" value={npr(perKill)} accent />
            <Row label="Booyah Prize" value={npr(booyah)} accent />
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
            className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg flex items-center gap-1"
          >
            <Coins size={12} /> Rs {t.entryFeeNpr} JOIN →
          </Link>
        </div>
      </div>
    </div>
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
