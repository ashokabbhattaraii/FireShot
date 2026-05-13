"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Coins, Plus, Swords, Gamepad2, Clock, UserRound, Trophy } from "lucide-react";
import { useToast, handleJoinError } from "@/lib/toast";
import { useAuth } from "@/lib/auth-context";
import { useFlags } from "@/lib/flags";
import { FeatureDisabledPage } from "@/components/FeatureDisabledPage";
import { ButtonLoading, CardSkeleton, LoadingState } from "@/components/ui";

type GameMode = "CS" | "LW" | "ALL";
type Status = "OPEN" | "MATCHED" | "COMPLETED" | "ALL";

export default function ChallengesPage() {
  const { user } = useAuth();
  const { isEnabled } = useFlags();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("ALL");
  const [status, setStatus] = useState<Status>("OPEN");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (gameMode !== "ALL") params.set("gameMode", gameMode);
    if (status !== "ALL") params.set("status", status);
    setErr(null);
    setLoading(true);
    try {
      setItems(await api(`/challenges?${params}`));
    } catch (e: any) {
      setErr(e.message ?? "Could not load challenges");
    } finally {
      setLoading(false);
    }
  }, [gameMode, status]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  if (!isEnabled("CHALLENGE_ENABLED")) {
    return <FeatureDisabledPage name="Challenges" />;
  }

  async function quickJoin(id: string) {
    if (!user) return toast.warning("Please sign in to join.");
    setJoiningId(id);
    try {
      await api(`/challenges/${id}/join`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Joined!");
      load();
    } catch (e: any) {
      handleJoinError(e, toast);
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="fs-h2 flex items-center gap-2">
            <Swords size={20} style={{ color: 'var(--fs-red)' }} /> Challenges
          </h1>
          <p className="fs-caption mt-0.5">1v1 / Squad Matches</p>
        </div>
        <Link href="/challenges/create" className="fs-btn fs-btn-primary fs-btn-sm">
          <Plus size={14} /> Create
        </Link>
      </div>

      {/* Filters */}
      <div className="fs-card fs-card-body">
        <div className="flex flex-wrap gap-2">
          <FilterPills
            options={["ALL", "CS", "LW"]}
            value={gameMode}
            onChange={(v) => setGameMode(v as GameMode)}
          />
          <FilterPills
            options={["OPEN", "MATCHED", "COMPLETED", "ALL"]}
            value={status}
            onChange={(v) => setStatus(v as Status)}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="fs-skeleton" style={{ height: '120px' }} />
          <div className="fs-skeleton" style={{ height: '120px' }} />
          <div className="fs-skeleton" style={{ height: '120px' }} />
        </div>
      ) : err ? (
        <LoadingState label={err} />
      ) : items.filter((c) => c.gameMode === "CS" || c.gameMode === "LW").length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--fs-text-3)' }}>No challenges in this filter</p>
      ) : (
        <div
          className="challenge-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
            gap: 12,
          }}
        >
          {items.filter((c) => c.gameMode === "CS" || c.gameMode === "LW").map((c) => {
            const ign = c.creator?.profile?.ign ?? c.creator?.name ?? c.creator?.email;
            const lvl = c.creator?.profile?.level;
            const statusBadgeClass = c.status === "OPEN" ? "fs-badge-green"
              : c.status === "MATCHED" || c.status === "ONGOING" ? "fs-badge-amber"
              : c.status === "COMPLETED" ? "fs-badge-gray"
              : "fs-badge-red";

            return (
              <div key={c.id} className="fs-card fs-card-body transition hover:border-[var(--fs-red)]">
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="fs-badge" style={{ background: 'rgba(156,39,176,0.15)', color: '#CE93D8' }}>
                      CH-{c.challengeNumber}
                    </span>
                    <span className={`fs-badge ${c.gameMode === "CS" ? "fs-badge-gold" : "fs-badge-gray"}`}>
                      {c.gameMode}
                    </span>
                    {c.gameMode === "CS" ? (
                      <span className="fs-badge fs-badge-gray">{c.csTeamMode}</span>
                    ) : c.gameMode === "LW" ? (
                      <span className="fs-badge fs-badge-gray">{c.lwTeamMode}</span>
                    ) : null}
                  </div>
                  <span className={`fs-badge ${statusBadgeClass}`}>
                    {c.status}
                  </span>
                </div>

                <Link href={`/challenges/${c.id}`} className="mt-3 block">
                  <h2 className="truncate text-base font-bold" style={{ color: "var(--fs-text-1)" }}>
                    {c.title}
                  </h2>

                  {/* VS Row */}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ background: 'var(--fs-surface-3)' }}
                      >
                        <Gamepad2 size={16} style={{ color: 'var(--fs-text-2)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--fs-text-1)' }}>{ign}</p>
                        <p className="text-[10px]" style={{ color: 'var(--fs-text-3)' }}>
                          {lvl ? `Lv ${lvl}` : "Level hidden"}
                          {c.minLevel > 0 ? ` · Need Lv${c.minLevel}+` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold" style={{ color: 'var(--fs-text-3)' }}>VS</span>
                    <div className="min-w-0 text-right">
                      <p className="truncate text-sm font-semibold" style={{ color: c.opponent ? "var(--fs-text-1)" : "var(--fs-text-3)" }}>
                        {c.opponent?.profile?.ign ?? c.opponent?.name ?? "Open Slot"}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--fs-text-3)' }}>
                        {c.opponent ? "Opponent locked" : "Waiting"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniStat icon={<Coins size={12} />} label="Entry" value={`Rs ${c.entryFee}`} />
                    <MiniStat icon={<Trophy size={12} />} label="Prize" value={`Rs ${c.prizeToWinner}`} />
                    <MiniStat icon={<Clock size={12} />} label="Time" value={c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString() : "Now"} />
                  </div>
                </Link>

                {/* Bottom row */}
                <div className="mt-3 flex items-center justify-between" style={{ borderTop: '0.5px solid var(--fs-border)', paddingTop: '10px' }}>
                  <div className="flex min-w-0 items-center gap-2 text-xs" style={{ color: 'var(--fs-text-3)' }}>
                    <UserRound size={12} className="shrink-0" />
                    <span className="truncate">
                      {c.opponent ? "Ready to play" : "Accepting opponent"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/challenges/${c.id}`} className="fs-btn fs-btn-outline fs-btn-sm">Details</Link>
                    {c.status === "OPEN" && user?.id !== c.creatorId && (
                      <button
                        disabled={joiningId === c.id}
                        onClick={() => quickJoin(c.id)}
                        className="fs-btn fs-btn-primary fs-btn-sm"
                      >
                        <ButtonLoading loading={joiningId === c.id} loadingText="...">
                          JOIN
                        </ButtonLoading>
                      </button>
                    )}
                    {c.status === "COMPLETED" && c.winnerId && (
                      <span className="fs-badge fs-badge-gold">
                        Winner: {c.winnerId === c.creatorId ? ign : "Opponent"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-2" style={{ background: "var(--fs-surface-1)", border: "0.5px solid var(--fs-border)" }}>
      <p className="flex items-center gap-1 text-[9px] uppercase font-semibold" style={{ color: "var(--fs-text-3)" }}>
        {icon} {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold" style={{ color: "var(--fs-text-1)" }}>{value}</p>
    </div>
  );
}

function FilterPills({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          style={{
            background: value === o ? 'var(--fs-red)' : 'var(--fs-surface-2)',
            color: value === o ? '#fff' : 'var(--fs-text-3)',
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
