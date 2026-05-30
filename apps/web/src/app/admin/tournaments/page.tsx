"use client";

import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, FILE_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  GameModeLabels,
  GameModes,
  GameModeMaxTeams,
  GameModeTeamSize,
  TournamentTypeLabels,
  isWinnerTakesAllOnly,
} from "@fireslot/shared";
import { fmtDate, npr } from "@/lib/utils";
import { ButtonLoading, CardSkeleton, ConfirmDialog, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

const BANNED_GUNS = ["Double Vector", "M79", "Grenade Launcher", "Rocket Launcher"];

export default function AdminTournaments() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [publicStats, setPublicStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  // Inline results modal state
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [modalTournament, setModalTournament] = useState<any | null>(null);
  const [resultsItems, setResultsItems] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { placement: string; kills: string; note: string }>>({});
  const [roomDrafts, setRoomDrafts] = useState<Record<string, { roomId: string; roomPassword: string }>>({});
  const [resultParticipants, setResultParticipants] = useState<any[]>([]);
  const [manualResultDrafts, setManualResultDrafts] = useState<Record<string, { placement: string; kills: string }>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(6);
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    description?: ReactNode;
    confirmLabel: string;
    tone?: "danger" | "primary";
    run: () => Promise<void> | void;
  }>(null);

  // Minimal create form state & handlers (previously removed) — keep lightweight
  // to avoid runtime ReferenceError for `open` / `create` while preserving
  // existing UI. Replace with full create flow later if needed.
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    title: "",
    map: "",
    mode: GameModes?.[0] ?? "",
    type: "SOLO_TOP3",
    description: "",
    entryFeeNpr: 20,
    maxTeams: undefined,
    maxSlots: 2,
    dateTime: "",
    minLevel: 1,
    maxHeadshotRate: 100,
    allowEmulator: false,
    characterSkillOn: false,
    gunAttributesOn: false,
    bannedGuns: [],
    rules: "",
  });

  function applyModeDefaults(mode: string) {
    setForm((prev: any) => ({
      ...prev,
      mode,
      maxTeams: prev.maxTeams ?? GameModeMaxTeams[mode as keyof typeof GameModeMaxTeams],
      maxSlots: prev.maxSlots ?? (GameModeMaxTeams[mode as keyof typeof GameModeMaxTeams] * GameModeTeamSize[mode as keyof typeof GameModeTeamSize]),
    }));
  }

  const prizePreview: any = null;
  const formIsWTA = form.type === "SOLO_1ST" || isWinnerTakesAllOnly(form.mode ?? "");
  const formIsPlacementPrize = form.type === "SOLO_TOP3" || form.type === "SQUAD_TOP10" || form.type === "COMBO";
  const formIsKillPrize = form.type === "KILL_RACE" || form.type === "COMBO";
  const typeLocked = false;

  async function create(e: any) {
    e?.preventDefault?.();
    setCreating(true);
    setMsg(null);
    try {
      // Best-effort: submit form to backend. If the backend requires a
      // different payload, this acts as a safe stub until full create is built.
      await api("/tournaments", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMsg("Tournament created");
      setOpen(false);
      await load(false);
    } catch (err: any) {
      setMsg(err?.message ?? "Could not create tournament");
    } finally {
      setCreating(false);
    }
  }

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setItems(await api("/tournaments/admin/list"));
      // load admin/public stats (best-effort)
      try { setAdminStats(await api("/admin/stats")); } catch (e) { setAdminStats(null); }
      try { setPublicStats(await api("/app/stats")); } catch (e) { setPublicStats(null); }
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => {
    load().catch(() => {});
    api("/tournaments/admin/assignees").then(setAssignees).catch(() => setAssignees([]));
  }, []);

  async function setStatus(id: string, status: string) {
    setActionKey(`${id}:status`);
    setMsg(null);
    try {
      await api(`/tournaments/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await load(false);
    } catch (e: any) {
      setMsg(e.message ?? "Could not update status");
    } finally {
      setActionKey(null);
    }
  }

  async function publishRoom(id: string, room?: { roomId?: string; roomPassword?: string }) {
    const draft = room ?? roomDrafts[id];
    const roomId = draft?.roomId?.trim();
    const roomPassword = draft?.roomPassword?.trim();
    if (!roomId || !roomPassword) {
      setMsg("Enter both Room ID and Room password before publishing.");
      return;
    }
    setMsg(null);
    setActionKey(`${id}:room`);
    try {
      await api(`/tournaments/${id}/room`, {
        method: "PUT",
        body: JSON.stringify({ roomId, roomPassword }),
      });
      setRoomDrafts((prev) => ({ ...prev, [id]: { roomId, roomPassword } }));
      await load(false);
    } catch (e: any) {
      setMsg(e.message ?? "Could not publish room");
    } finally {
      setActionKey(null);
    }
  }

  async function lockRoom(id: string) {
    setActionKey(`${id}:lock`);
    try {
      await api(`/tournaments/${id}/lock-room`, { method: "POST" });
      await load(false);
    } catch (e: any) {
      setMsg(e.message ?? "Could not lock room");
    } finally {
      setActionKey(null);
    }
  }

  async function deleteTournament(id: string) {
    setConfirmAction({
      title: "Delete tournament?",
      description: "This permanently removes the tournament and cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
      run: async () => {
        setActionKey(`${id}:delete`);
        try {
          await api(`/tournaments/${id}`, { method: "DELETE" });
          await load(false);
        } catch (e: any) {
          setMsg(e.message ?? "Could not delete tournament");
        } finally {
          setActionKey(null);
        }
      },
    });
  }

  async function assignAdmin(tournamentId: string, adminId: string) {
    setActionKey(`${tournamentId}:assign`);
    setMsg(null);
    try {
      await api(`/tournaments/${tournamentId}/assign-admin`, {
        method: "PUT",
        body: JSON.stringify({ adminId: adminId || null }),
      });
      await load(false);
    } catch (e: any) {
      setMsg(e.message ?? "Only super admin can assign tournament managers");
    } finally {
      setActionKey(null);
    }
  }

  // dummy-mode toggle removed

  async function openResultsModal(tournament: any) {
    setModalTournament(tournament);
    setResultsModalOpen(true);
    setModalLoading(true);
    try {
      const data = await api(`/results?verified=false&tournamentId=${encodeURIComponent(tournament.id)}`);
      const full = await api(`/tournaments/${tournament.id}/full`);
      setResultsItems(data);
      const joinedParticipants = full.participants ?? [];
      setResultParticipants(joinedParticipants);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const item of data) {
          next[item.id] = next[item.id] ?? {
            placement: item.placement ?? "",
            kills: item.kills != null ? String(item.kills) : "",
            note: item.note ?? "",
          };
        }
        return next;
      });
      setManualResultDrafts((prev) => {
        const next = { ...prev };
        for (const participant of joinedParticipants) {
          next[participant.userId] = next[participant.userId] ?? {
            placement: participant.placement ? String(participant.placement) : "",
            kills: "",
          };
        }
        return next;
      });
    } catch (e) {
      setMsg("Failed to load results");
    } finally {
      setModalLoading(false);
    }
  }

  async function publishManualResults() {
    if (!modalTournament) return;
    if (resultParticipants.length === 0) {
      setMsg("No joined players found. Players must join before you can publish the tournament result.");
      return;
    }
    const missingKills = resultParticipants.filter((participant) => {
      const draft = manualResultDrafts[participant.userId] ?? { placement: "", kills: "" };
      return draft.kills.trim() === "";
    });
    if (missingKills.length > 0) {
      setMsg("Enter kills for every joined player/team. Use 0 when they got no kills.");
      return;
    }
    const needsPlacement = !modalIsKillRace;
    const missingPlacement = needsPlacement
      ? resultParticipants.filter((participant) => {
          const draft = manualResultDrafts[participant.userId] ?? { placement: "", kills: "" };
          return draft.placement.trim() === "";
        })
      : [];
    if (missingPlacement.length > 0) {
      setMsg("Enter final placement/rank for every joined player/team before publishing.");
      return;
    }
    if (modalIsWTA) {
      const winnerCount = resultParticipants.filter((participant) => {
        const draft = manualResultDrafts[participant.userId] ?? { placement: "", kills: "" };
        return Number(draft.placement) === 1;
      }).length;
      if (winnerCount !== 1) {
        setMsg("Winner takes all needs exactly one 1st place winner.");
        return;
      }
    }
    const winners = resultParticipants
      .map((participant) => {
        const draft = manualResultDrafts[participant.userId] ?? { placement: "", kills: "" };
        return {
          userId: participant.userId,
          placement: draft.placement ? Number(draft.placement) : undefined,
          kills: draft.kills ? Number(draft.kills) : 0,
          gotBooyah: draft.placement === "1",
        };
      })
      .sort((a, b) => {
        const placeA = a.placement ?? Number.MAX_SAFE_INTEGER;
        const placeB = b.placement ?? Number.MAX_SAFE_INTEGER;
        if (placeA !== placeB) return placeA - placeB;
        return b.kills - a.kills;
      });
    if (winners.length === 0) {
      setMsg("Add the official scoreboard before publishing results.");
      return;
    }
    setConfirmAction({
      title: "Publish tournament results?",
      description: (
        <>
          This will publish the official ranking/kills, credit prizes, and mark the tournament completed.
        </>
      ),
      confirmLabel: "Publish Results",
      tone: "primary",
      run: () => publishManualResultsNow(winners),
    });
  }

  async function publishManualResultsNow(winners: { userId: string; placement?: number; kills: number; gotBooyah: boolean }[]) {
    if (!modalTournament) return;
    setActionKey(`${modalTournament.id}:manual-results`);
    try {
      await api(`/tournaments/${modalTournament.id}/winners`, {
        method: "POST",
        body: JSON.stringify({ winners }),
      });
      setResultsModalOpen(false);
      await load(false);
    } catch (e: any) {
      setMsg(e.message ?? "Could not publish results");
    } finally {
      setActionKey(null);
    }
  }

  async function saveResult(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      await api(`/results/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          placement: draft.placement ? Number(draft.placement) : null,
          kills: draft.kills ? Number(draft.kills) : null,
          note: draft.note || null,
        }),
      });
      const updated = await api(`/results/${id}`);
      setResultsItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e: any) {
      setMsg(e.message || "Failed to save");
    } finally {
      setSavingId(null);
    }
  }

  async function verifyResult(id: string) {
    setVerifyingId(id);
    try {
      await api(`/results/${id}/verify`, { method: "POST" });
      setResultsItems((prev) => prev.filter((r) => r.id !== id));
      setDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } catch (e: any) {
      setMsg(e.message || "Failed to verify");
    } finally {
      setVerifyingId(null);
    }
  }

  // Auto-save timers
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  function scheduleAutoSave(id: string) {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id] as any);
    saveTimers.current[id] = setTimeout(() => {
      saveResult(id).catch(() => {});
      saveTimers.current[id] = null;
    }, 1200);
  }

  async function verifyAll() {
    setConfirmAction({
      title: "Verify all legacy results?",
      description: "This verifies all legacy player-submitted result rows for this tournament.",
      confirmLabel: "Verify All",
      tone: "primary",
      run: verifyAllNow,
    });
  }

  async function verifyAllNow() {
    for (const r of [...resultsItems]) {
      try {
        await verifyResult(r.id);
      } catch (e) {
        // continue
      }
    }
    // refresh list
    try {
      const data = await api(`/results?verified=false&tournamentId=${encodeURIComponent(modalTournament.id)}`);
      setResultsItems(data);
    } catch (e) {}
  }

  const modalIsWTA = !!modalTournament && (
    modalTournament.type === "SOLO_1ST" ||
    isWinnerTakesAllOnly(modalTournament.mode ?? "")
  );
  const modalIsKillRace = modalTournament?.type === "KILL_RACE";
  const modalIsTeamMode = !!modalTournament && (
    modalTournament.mode === "CS_4V4" ||
    modalTournament.mode === "LW_2V2" ||
    modalTournament.mode === "BR_DUO" ||
    modalTournament.mode === "BR_SQUAD"
  );
  const modalResultTitle = modalIsWTA
    ? "Winner takes all result"
    : modalTournament?.type === "KILL_RACE"
      ? "Kill race result"
      : modalTournament?.type === "COMBO"
        ? "Placement + kills result"
        : "Placement result";
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((t) => {
      const matchesSearch = !query || [
        t.title,
        t.description,
        t.mode,
        t.status,
        t.map,
        t.assignedAdmin?.name,
        t.assignedAdmin?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesMode = modeFilter === "ALL" || t.mode === modeFilter;
      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [items, modeFilter, search, statusFilter]);

  // Order tournaments for admin: LIVE first, then UPCOMING, then others, COMPLETED last
  const orderedFilteredItems = useMemo(() => {
    const statusOrder: Record<string, number> = {
      LIVE: 0,
      UPCOMING: 1,
      PENDING_RESULTS: 2,
      CANCELLED: 2,
      COMPLETED: 3,
    };
    return [...filteredItems].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 2;
      const sb = statusOrder[b.status] ?? 2;
      if (sa !== sb) return sa - sb;
      const ta = new Date(a.dateTime ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.dateTime ?? b.createdAt ?? 0).getTime();
      return ta - tb;
    });
  }, [filteredItems]);
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return orderedFilteredItems.slice(start, start + pageSize);
  }, [orderedFilteredItems, pageSize, safePage]);
  const pageStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(totalItems, safePage * pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search, statusFilter, modeFilter]);

  // seeded helpers removed (no dummy data)

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Tournaments"
        description="Pool scales with actual players. Per Kill and Booyah are auto-computed at room lock."
        action={
          <Link href="/admin/tournaments/create" className="btn-primary">
            + Create Tournament
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card/80 p-3 lg:grid-cols-[1.6fr_1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Search tournaments</span>
          <input
            className="input"
            placeholder="Title, mode, map, manager, status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Status</span>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="UPCOMING">UPCOMING</option>
            <option value="LIVE">LIVE</option>
            <option value="PENDING_RESULTS">PENDING_RESULTS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Mode</span>
          <select className="input" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="ALL">All modes</option>
            {GameModes.map((mode) => (
              <option key={mode} value={mode}>
                {GameModeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Per page</span>
          <select className="input" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[6, 8, 12, 16].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-white/65">
        <div className="flex items-center gap-4">
            <div>Users: <span className="font-semibold text-white">{adminStats?.users ?? "-"}</span></div>
            <div>Downloads: <span className="font-semibold text-white">{publicStats?.totalDownloads ?? "-"}</span></div>
          <div className="text-xs text-white/60">Tournaments: <span className="font-semibold text-white">{totalItems}</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline text-xs" onClick={() => { setSearch(""); setStatusFilter("ALL"); setModeFilter("ALL"); setPageSize(6); }}>
            Reset filters
          </button>
          <button type="button" className="btn-outline text-xs" onClick={() => load(false)} disabled={loading}>
            Refresh
          </button>
          <div />
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100">
          {msg}
        </div>
      )}

      {open && (
        <form onSubmit={create} className="card mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Map (Bermuda / Kalahari / Purgatory)"
              value={form.map}
              onChange={(e) => setForm({ ...form, map: e.target.value })}
            />
            <select
              className="input"
              value={form.mode}
              onChange={(e) => applyModeDefaults(e.target.value)}
            >
              {GameModes.map((m) => (
                <option key={m} value={m}>{GameModeLabels[m]}</option>
              ))}
            </select>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              disabled={typeLocked}
              title={typeLocked ? "CS/LW modes are always Winner Takes All" : ""}
            >
              <option value="SOLO_TOP3">Solo Top 3</option>
              <option value="SOLO_1ST">Solo Winner Takes All</option>
              <option value="SQUAD_TOP10">Squad Top 10</option>
              <option value="KILL_RACE">Kill Race</option>
              <option value="COMBO">Combo</option>
              <option value="FREE_DAILY">Free Daily</option>
            </select>
          </div>

          <textarea
            className="input"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {/* Entry Fee — slider + live preview, same pattern as challenge create */}
          <div className="rounded-xl border border-white/10 bg-[#0f0628] p-3">
            <p className="mb-2 flex items-center gap-1 text-sm font-bold text-white">
              💰 Entry Fee
            </p>
            <input
              type="range"
              min={20}
              max={50}
              step={5}
              value={form.entryFeeNpr}
              onChange={(e) => setForm({ ...form, entryFeeNpr: Number(e.target.value) })}
              className="w-full accent-yellow-400"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-white/70">
              <span>Rs {form.entryFeeNpr}</span>
              {prizePreview && formIsWTA && (
                <span>
                  Winner gets <b className="text-yellow-300">Rs {prizePreview.netPool}</b>
                </span>
              )}
              {prizePreview && formIsPlacementPrize && (
                <span>
                  {TournamentTypeLabels[form.type as keyof typeof TournamentTypeLabels]} · Top prize <b className="text-yellow-300">Rs {prizePreview.prizeBreakdown?.[0]?.amount ?? 0}</b>
                </span>
              )}
              {prizePreview && formIsKillPrize && (
                <span>
                  Per Kill <b className="text-yellow-300">Rs {prizePreview.perKillReward ?? 0}</b> · Booyah <b className="text-neon-cyan">Rs {prizePreview.booyahPrize ?? 0}</b>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {GameModeTeamSize[form.mode as keyof typeof GameModeTeamSize] > 1 ? (
              (() => {
                const isFixedMode = form.mode === "CS_4V4" || form.mode === "LW_1V1" || form.mode === "LW_2V2";
                const teamSize = GameModeTeamSize[form.mode as keyof typeof GameModeTeamSize];
                const maxTeams = form.maxTeams || GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams];
                
                if (isFixedMode) {
                  return (
                    <div>
                      <label className="label">Team Configuration (Fixed)</label>
                      <div className="input bg-white/5 flex items-center justify-between px-3 py-2 cursor-not-allowed">
                        <span className="text-white/80">
                          {maxTeams} teams × {teamSize}v{teamSize} = {maxTeams * teamSize} players
                        </span>
                        <span className="text-xs bg-neon/20 text-neon px-2 py-1 rounded">LOCKED</span>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <NumberInput
                    label={`Max Teams (${teamSize}v${teamSize})`}
                    value={maxTeams}
                    onChange={(v) => {
                      const maxTeamCap = GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams];
                      const minTeams = 1;
                      const safeTeams = Math.max(minTeams, Math.min(v, maxTeamCap));
                      setForm({ ...form, maxTeams: safeTeams, maxSlots: safeTeams * teamSize });
                    }}
                    min={1}
                    max={GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams]}
                    step={1}
                  />
                );
              })()
            ) : (
              <NumberInput
                label="Max Players"
                value={form.maxSlots}
                onChange={(v) => {
                  const cap = GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams] * GameModeTeamSize[form.mode as keyof typeof GameModeTeamSize];
                  const safePlayers = Math.max(2, Math.min(v, cap));
                  setForm({ ...form, maxSlots: safePlayers });
                }}
                min={2}
                max={GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams] * GameModeTeamSize[form.mode as keyof typeof GameModeTeamSize]}
                step={1}
              />
            )}
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                type="datetime-local"
                value={form.dateTime}
                onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
                required
              />
            </div>
          </div>

          {prizePreview && (
            <div className="rounded-lg border border-neon/40 bg-neon/5 p-3 text-sm">
              <p className="label text-neon">If {prizePreview.estimatedFor ?? prizePreview.actualPlayers} players join</p>
              <p className="mt-1 text-white/80">
                Pool <b>{npr(prizePreview.grossPool)}</b> →
                Platform <b>{npr(prizePreview.platformFee ?? prizePreview.platformCut)}</b> ({prizePreview.systemFeePercent ?? 20}%) →
                Net <b>{npr(prizePreview.netPool)}</b>
              </p>
              {formIsWTA ? (
                <p className="mt-1 text-white/80">
                  <b className="text-yellow-300">Winner Takes All:</b> 1st place gets {npr(prizePreview.netPool)}
                </p>
              ) : formIsPlacementPrize ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(prizePreview.prizeBreakdown ?? []).slice(0, form.type === "SQUAD_TOP10" ? 10 : 3).map((prize: any) => (
                    <div key={prize.rank} className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
                      <p className="text-[10px] text-white/50">{prize.rank}</p>
                      <p className="font-bold text-yellow-300">{npr(prize.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : formIsKillPrize ? (
                <p className="mt-1 text-white/80">
                  Per Kill: <b className="text-neon">{npr(prizePreview.perKillReward)}</b> · Booyah: <b className="text-neon-cyan">{npr(prizePreview.booyahPrize)}</b>
                </p>
              ) : (
                null
              )}
              <p className="mt-1 text-xs text-white/50">{prizePreview.scalingNote ?? "Pool scales with actual players."}</p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface/50 p-3">
            <p className="label mb-2">Eligibility</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <NumberInput label="Min FF Level" value={form.minLevel} onChange={(v) => setForm({ ...form, minLevel: v })} min={1} step={1} />
              <NumberInput label="Max Headshot %" value={form.maxHeadshotRate} onChange={(v) => setForm({ ...form, maxHeadshotRate: v })} min={0} max={100} step={1} />
              <Toggle label="Allow Emulator" checked={form.allowEmulator} onChange={(v) => setForm({ ...form, allowEmulator: v })} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface/50 p-3">
            <p className="label mb-2">Room Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <Toggle label="Character Skill" checked={form.characterSkillOn} onChange={(v) => setForm({ ...form, characterSkillOn: v })} />
              <Toggle label="Gun Attributes" checked={form.gunAttributesOn} onChange={(v) => setForm({ ...form, gunAttributesOn: v })} />
            </div>
            <p className="label mt-3 mb-1">Banned Guns</p>
            <div className="flex flex-wrap gap-2">
              {BANNED_GUNS.map((g) => {
                const active = form.bannedGuns.includes(g);
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() =>
                      setForm({
                        ...form,
                        bannedGuns: active
                          ? form.bannedGuns.filter((x: string) => x !== g)
                          : [...form.bannedGuns, g],
                      })
                    }
                    className={`px-2 py-1 rounded text-xs ${active ? "bg-red-500/20 border border-red-500/50 text-red-300" : "bg-surface text-white/60 border border-border"}`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            className="input"
            placeholder="Extra rules (optional)"
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
          />

          <button className="btn-primary w-full" disabled={creating}>
            <ButtonLoading loading={creating} loadingText="Creating tournament...">
              Create Tournament
            </ButtonLoading>
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No tournaments yet" />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No matching tournaments"
          description="Clear a filter or widen the search to see more tournaments."
        />
      ) : (
        <div className="space-y-3">
          {pagedItems.map((t) => {
            const displayedPlayers = (t.participants?.length ?? t.actualPlayers ?? t.filledSlots ?? 0);
            return (
            <div
              key={t.id}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-br from-[#13132a] to-[#0f0f1f] p-5 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)] ${
                t.status === "LIVE"
                  ? "border-[#ff2d75]/30 shadow-[0_0_15px_rgba(255,45,117,0.1)] before:absolute before:left-0 before:top-0 before:h-full before:w-[4px] before:bg-[#ff2d75]"
                  : t.status === "UPCOMING"
                    ? "border-[#ff7a00]/20 before:absolute before:left-0 before:top-0 before:h-full before:w-[4px] before:bg-[#ff7a00]"
                    : t.status === "PENDING_RESULTS"
                      ? "border-[#00f0ff]/20 before:absolute before:left-0 before:top-0 before:h-full before:w-[4px] before:bg-[#00f0ff]"
                      : t.status === "COMPLETED"
                        ? "border-[#39ff14]/20 before:absolute before:left-0 before:top-0 before:h-full before:w-[4px] before:bg-[#39ff14]"
                        : "border-white/5 before:absolute before:left-0 before:top-0 before:h-full before:w-[4px] before:bg-white/20"
              }`}
            >
              {/* Header Zone */}
              <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-white/[0.05]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-white/60">
                      {GameModeLabels[t.mode as keyof typeof GameModeLabels] || t.mode}
                    </span>
                    {t.map && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff]">
                        🗺️ {t.map}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white tracking-wide leading-snug">{t.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                    <span className="flex items-center gap-1">📅 {fmtDate(t.dateTime)}</span>
                    <span className="text-white/20">•</span>
                    <span className="flex items-center gap-1">
                      👤 Manager:{" "}
                      <strong className="text-white/80">
                        {t.assignedAdmin?.name ?? t.assignedAdmin?.email ?? (t.createdById === user?.id ? "You" : "Unassigned")}
                      </strong>
                    </span>
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>

              {/* Stats Zone */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Fee</p>
                  <p className="mt-1 text-sm font-extrabold text-white">{npr(t.entryFeeNpr)}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {t.type === "SOLO_1ST" ? "Winner Gets" : t.type === "SOLO_TOP3" || t.type === "SQUAD_TOP10" ? "Top Prize" : "Per Kill"}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-yellow-400">
                    {t.type === "SOLO_1ST"
                      ? npr(t.prizeStructure?.netPool ?? t.prizePoolNpr ?? 0)
                      : t.type === "SOLO_TOP3" || t.type === "SQUAD_TOP10"
                        ? npr(t.prizeStructure?.prizeBreakdown?.[0]?.amount ?? 0)
                        : npr(t.perKillReward ?? 0)}
                  </p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {t.type === "SOLO_TOP3" || t.type === "SQUAD_TOP10" ? "Payout" : "Booyah"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#00f0ff] truncate">
                    {t.type === "SOLO_TOP3" || t.type === "SQUAD_TOP10"
                      ? TournamentTypeLabels[t.type as keyof typeof TournamentTypeLabels]
                      : npr(t.booyahPrize ?? 0)}
                  </p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 transition-colors hover:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize] > 1 ? "Teams" : "Players"}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-[#39ff14]">
                    {GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize] > 1
                      ? `${Math.floor(displayedPlayers / GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize])}/${t.maxTeams || Math.floor(t.maxSlots / GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize])}`
                      : `${displayedPlayers}/${t.maxSlots}`}
                  </p>
                </div>
              </div>

              {/* Manager Assignment Zone */}
              {user?.role === "SUPER_ADMIN" && (
                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 whitespace-nowrap shrink-0 sm:pl-1">
                    Assign Manager
                  </span>
                  <select
                    className="w-full bg-[#16162a] border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#E53935] min-h-[36px]"
                    value={t.assignedAdminId ?? ""}
                    onChange={(e) => assignAdmin(t.id, e.target.value)}
                    disabled={actionKey === `${t.id}:assign`}
                  >
                    <option value="">Unassigned: super admin manages</option>
                    {assignees.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name ?? admin.email} ({admin.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Step Alert Zone */}
              <div
                className={`mt-4 rounded-lg border p-3 text-xs leading-relaxed ${
                  t.status === "UPCOMING"
                    ? "border-amber-500/20 bg-amber-500/5 text-amber-200/90"
                    : t.status === "LIVE"
                      ? "border-[#ff2d75]/20 bg-[#ff2d75]/5 text-pink-200/90"
                      : t.status === "PENDING_RESULTS"
                        ? "border-[#00f0ff]/20 bg-[#00f0ff]/5 text-cyan-200/90"
                        : t.status === "COMPLETED"
                          ? "border-[#39ff14]/20 bg-[#39ff14]/5 text-green-200/90"
                          : "border-white/10 bg-white/5 text-white/60"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0">
                    {t.status === "UPCOMING"
                      ? "🔑"
                      : t.status === "LIVE"
                        ? "🔥"
                        : t.status === "PENDING_RESULTS"
                          ? "📊"
                          : t.status === "COMPLETED"
                            ? "✅"
                            : "⚠️"}
                  </span>
                  <p className="font-medium">
                    {t.status === "UPCOMING"
                      ? "Step 1: Publish Room ID + password. Wait around 10 minutes in Free Fire, then start match."
                      : t.status === "LIVE"
                        ? "Step 2: Match is live. Watch kills, rankings, suspicious play, and winner in Free Fire. End match when game concludes."
                        : t.status === "PENDING_RESULTS"
                          ? "Step 3: Enter the official final placement and kills from Free Fire, then publish results."
                          : t.status === "COMPLETED"
                            ? "Completed: Players can now view the official scoreboard and prize credits."
                            : "Cancelled tournament."}
                  </p>
                </div>
              </div>

              {/* Room Setup Zone */}
              {(t.status === "UPCOMING" || t.status === "LIVE") && (
                <div className="mt-4 border border-white/[0.05] bg-white/[0.01] rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Room Credentials</p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
                    <input
                      className="w-full bg-[#16162a] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-[#E53935] min-h-[38px]"
                      placeholder="Room ID"
                      value={roomDrafts[t.id]?.roomId ?? ""}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] ?? { roomId: "", roomPassword: "" }), roomId: e.target.value },
                        }))
                      }
                    />
                    <input
                      className="w-full bg-[#16162a] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-[#E53935] min-h-[38px]"
                      placeholder="Room password"
                      value={roomDrafts[t.id]?.roomPassword ?? ""}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] ?? { roomId: "", roomPassword: "" }), roomPassword: e.target.value },
                        }))
                      }
                    />
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold bg-[#E53935] hover:bg-[#B71C1C] text-white transition-colors min-h-[38px] cursor-pointer"
                      type="button"
                      onClick={() => publishRoom(t.id, roomDrafts[t.id])}
                      disabled={actionKey === `${t.id}:room`}
                    >
                      <ButtonLoading loading={actionKey === `${t.id}:room`} loadingText="Saving...">
                        Save Room
                      </ButtonLoading>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Bar Zone */}
              <div className="mt-4 pt-3.5 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-3">
                {/* Left operations */}
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tournaments/${t.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-white transition-all min-h-[36px]"
                  >
                    🔍 View Detail
                  </Link>

                  {(t.status === "PENDING_RESULTS" || t.status === "LIVE" || t.status === "COMPLETED") && (
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-all min-h-[36px] cursor-pointer ${
                        t.status === "PENDING_RESULTS"
                          ? "bg-[#E53935] hover:bg-[#B71C1C] text-white shadow-[0_0_10px_rgba(229,57,53,0.2)]"
                          : "border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] text-white"
                      }`}
                      onClick={() => openResultsModal(t)}
                      disabled={actionKey?.startsWith(`${t.id}:`)}
                    >
                      🏆 Update Results
                    </button>
                  )}

                  {t.status === "UPCOMING" && (
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/20 text-[#39ff14] px-3.5 py-2 text-xs font-semibold transition-all min-h-[36px] cursor-pointer"
                      onClick={() => setStatus(t.id, "LIVE")}
                      disabled={actionKey?.startsWith(`${t.id}:`)}
                    >
                      <ButtonLoading loading={actionKey === `${t.id}:status`} loadingText="Starting...">
                        ▶️ Start Match
                      </ButtonLoading>
                    </button>
                  )}

                  {t.status === "LIVE" && (
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#ff7a00]/10 hover:bg-[#ff7a00]/20 border border-[#ff7a00]/20 text-[#ff7a00] px-3.5 py-2 text-xs font-semibold transition-all min-h-[36px] cursor-pointer"
                      onClick={() => setStatus(t.id, "PENDING_RESULTS")}
                      disabled={actionKey?.startsWith(`${t.id}:`)}
                    >
                      <ButtonLoading loading={actionKey === `${t.id}:status`} loadingText="Ending...">
                        ⏸️ End Match
                      </ButtonLoading>
                    </button>
                  )}
                </div>

                {/* Right operations (Status override dropdown & delete) */}
                <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
                  <select
                    onChange={(e) => setStatus(t.id, e.target.value)}
                    className="bg-[#16162a] border border-white/10 rounded-md px-2 py-2 text-xs text-white/70 outline-none focus:border-[#E53935] min-h-[36px] flex-1 sm:flex-initial"
                    value={t.status}
                    disabled={actionKey?.startsWith(`${t.id}:`)}
                    title="Manual status override"
                  >
                    <option value="UPCOMING">UPCOMING</option>
                    <option value="LIVE">LIVE</option>
                    <option value="PENDING_RESULTS">PENDING_RESULTS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>

                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 px-3 py-2 text-xs font-semibold transition-all min-h-[36px] cursor-pointer"
                    onClick={() => deleteTournament(t.id)}
                    disabled={actionKey?.startsWith(`${t.id}:`)}
                  >
                    <ButtonLoading loading={actionKey === `${t.id}:delete`} loadingText="Deleting...">
                      🗑️ Delete
                    </ButtonLoading>
                  </button>
                </div>
              </div>
            </div>
            );
          })}
          {totalItems > pageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/80 px-4 py-3">
              <p className="text-xs text-white/55">
                Page <span className="font-semibold text-white">{safePage}</span> of <span className="font-semibold text-white">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-outline text-xs"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {resultsModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-8">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResultsModalOpen(false)} />
          <div className="relative z-30 w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-[#0b0a12] rounded-lg p-4 text-white">
            <div className="flex items-center justify-between sticky top-0 bg-[#0b0a12] pb-3 z-10">
              <h3 className="font-semibold">Results — {modalTournament?.title}</h3>
              <div className="flex items-center gap-2">
                {resultsItems.length > 0 && (
                  <button className="btn-outline text-sm" onClick={() => verifyAll()}>Verify All</button>
                )}
                <button className="btn text-sm" onClick={() => setResultsModalOpen(false)}>Close</button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-neon/30 bg-neon/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{modalResultTitle}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {modalIsWTA
                        ? "Enter every final rank and kill count. The 1st place player/team receives the full winner prize."
                        : modalIsKillRace
                          ? "Enter kills for every joined player/team. Use 0 when they got no kills."
                        : "Enter the official final placement and kills from the match."}
                    </p>
                  </div>
                  <button
                    className="btn-primary text-xs"
                    onClick={() => publishManualResults()}
                    disabled={actionKey === `${modalTournament?.id}:manual-results`}
                  >
                    <ButtonLoading loading={actionKey === `${modalTournament?.id}:manual-results`} loadingText="Publishing...">
                      Publish Results
                    </ButtonLoading>
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {resultParticipants.length === 0 ? (
                    <p className="text-xs text-white/50">No joined players found. Players must join before you can publish the tournament result.</p>
                  ) : (
                    resultParticipants.map((participant, index) => {
                      const ign = participant.user?.profile?.ign ?? "Player";
                      const teamNames = participant.teamMembers?.map((member: any) => member.igName).filter(Boolean) ?? [];
                      const rosterUids = participant.submittedPlayerUids?.length
                        ? participant.submittedPlayerUids
                        : participant.teamMembers?.map((member: any) => member.freefireUid).filter(Boolean) ?? [];
                      const draft = manualResultDrafts[participant.userId] ?? { placement: "", kills: "" };
                      const isWinner = draft.placement === "1";
                      return (
                        <div key={participant.id} className="rounded-md border border-border bg-black/20 p-2">
                          <div className={`grid items-center gap-2 ${modalIsWTA ? "grid-cols-[1fr_96px_90px_90px]" : modalIsKillRace ? "grid-cols-[1fr_90px]" : "grid-cols-[1fr_90px_90px]"}`}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {modalIsTeamMode ? `Team ${index + 1}` : ign}
                            </p>
                            {teamNames.length > 0 && (
                              <p className="truncate text-[10px] text-white/45">Team: {teamNames.join(", ")}</p>
                            )}
                            {modalIsTeamMode && teamNames.length === 0 && (
                              <p className="truncate text-[10px] text-white/45">Captain: {ign}</p>
                            )}
                          </div>
                          {modalIsWTA ? (
                            <button
                              type="button"
                              className={`${isWinner ? "btn-primary" : "btn-outline"} text-xs`}
                              onClick={() =>
                                setManualResultDrafts((prev) => {
                                  const next = { ...prev };
                                  for (const p of resultParticipants) {
                                    next[p.userId] = {
                                      ...(next[p.userId] ?? { placement: "", kills: "" }),
                                      placement: p.userId === participant.userId ? "1" : next[p.userId]?.placement === "1" ? "" : (next[p.userId]?.placement ?? ""),
                                    };
                                  }
                                  return next;
                                })
                              }
                            >
                              {isWinner ? "Winner" : "Set Winner"}
                            </button>
                          ) : (
                            null
                          )}
                          {!modalIsKillRace && (
                            <input
                              className="input text-sm"
                              placeholder="Rank"
                              inputMode="numeric"
                              value={draft.placement}
                              onChange={(e) =>
                                setManualResultDrafts((prev) => ({
                                  ...prev,
                                  [participant.userId]: {
                                    ...(prev[participant.userId] ?? { placement: "", kills: "" }),
                                    placement: e.target.value.replace(/\D/g, ""),
                                  },
                                }))
                              }
                            />
                          )}
                          <input
                            className="input text-sm"
                            placeholder="Kills"
                            inputMode="numeric"
                            value={draft.kills}
                            onChange={(e) =>
                              setManualResultDrafts((prev) => ({
                                ...prev,
                                [participant.userId]: {
                                  ...(prev[participant.userId] ?? { placement: "", kills: "" }),
                                  kills: e.target.value.replace(/\D/g, ""),
                                },
                              }))
                            }
                          />
                          </div>
                          {modalIsTeamMode && rosterUids.length > 0 && (
                            <div className="mt-2 overflow-hidden rounded border border-border">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-white/5 text-white/45">
                                  <tr>
                                    <th className="px-2 py-1 font-semibold">Slot</th>
                                    <th className="px-2 py-1 font-semibold">Player UID</th>
                                    <th className="px-2 py-1 font-semibold">IGN</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rosterUids.map((uid: string, slotIndex: number) => (
                                    <tr key={`${participant.id}:${uid}`} className="border-t border-border">
                                      <td className="px-2 py-1 text-white/50">#{slotIndex + 1}</td>
                                      <td className="px-2 py-1 font-mono text-white">{uid}</td>
                                      <td className="px-2 py-1 text-white/70">
                                        {participant.teamMembers?.find((member: any) => member.freefireUid === uid)?.igName ?? (slotIndex === 0 ? ign : "Roster player")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {modalLoading ? (
                <p className="text-sm text-white/60">Loading results...</p>
              ) : resultsItems.length === 0 ? (
                <p className="text-sm text-white/60">No legacy player-submitted results. Use the official admin result form above.</p>
              ) : (
                resultsItems.map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-surface/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-white/70 font-medium">
                          {r.submitter?.profile?.ign ?? r.submitter?.email ?? r.id}
                        </p>
                        {r.screenshotUrl && (
                          <Image
                            src={`${FILE_BASE}${r.screenshotUrl}`}
                            alt="screenshot"
                            width={640}
                            height={360}
                            unoptimized
                            className="mt-2 h-auto max-h-32 rounded border border-border object-cover"
                            sizes="(max-width: 768px) 100vw, 640px"
                          />
                        )}
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <input className="input text-sm" placeholder="Placement" value={drafts[r.id]?.placement ?? ""} onChange={(e) => { setDrafts((p) => ({ ...p, [r.id]: { ...(p[r.id] || { placement: "", kills: "", note: "" }), placement: e.target.value } })); scheduleAutoSave(r.id); }} />
                          <input className="input text-sm" placeholder="Kills" inputMode="numeric" value={drafts[r.id]?.kills ?? ""} onChange={(e) => { setDrafts((p) => ({ ...p, [r.id]: { ...(p[r.id] || { placement: "", kills: "", note: "" }), kills: e.target.value.replace(/\D/g, "") } })); scheduleAutoSave(r.id); }} />
                          <input className="input text-sm" placeholder="Note" value={drafts[r.id]?.note ?? ""} onChange={(e) => { setDrafts((p) => ({ ...p, [r.id]: { ...(p[r.id] || { placement: "", kills: "", note: "" }), note: e.target.value } })); scheduleAutoSave(r.id); }} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button className="btn-outline text-xs" onClick={() => { if (saveTimers.current[r.id]) { clearTimeout(saveTimers.current[r.id] as any); saveTimers.current[r.id] = null; } saveResult(r.id); }} disabled={savingId === r.id}>
                          <ButtonLoading loading={savingId === r.id} loadingText="...">Save</ButtonLoading>
                        </button>
                        <button className="btn-primary text-xs" onClick={() => verifyResult(r.id)} disabled={verifyingId === r.id}>
                          <ButtonLoading loading={verifyingId === r.id} loadingText="...">Verify</ButtonLoading>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirm"}
        tone={confirmAction?.tone ?? "danger"}
        loading={!!actionKey}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const action = confirmAction;
          if (!action) return;
          await action.run();
          setConfirmAction(null);
        }}
      />
    </div>
  );
}

function NumberInput({
  label, value, onChange, min = 0, max, step = 5,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          let next = digits ? Number(digits) : min;
          if (!Number.isFinite(next)) next = min;
          if (typeof max === "number") {
            next = Math.min(max, Math.max(min, next));
          } else {
            next = Math.max(min, next);
          }
          if (step > 1) {
            next = Math.round(next / step) * step;
          }
          onChange(next);
        }}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface px-2 py-2 text-xs">
      <span className="text-white/80">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-border rounded-full peer-checked:bg-neon transition" />
        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white peer-checked:translate-x-4 transition" />
      </label>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <p className="label">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}
