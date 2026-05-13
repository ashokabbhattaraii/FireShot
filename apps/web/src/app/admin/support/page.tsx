"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Gavel, Send, X, ShieldAlert } from "lucide-react";
import { ButtonLoading, CardSkeleton, TableLoading } from "@/components/ui";

const STATUS_TABS = ["All", "OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_PLAYER", "RESOLVED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_PLAYER", "RESOLVED", "CLOSED"];

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "text-red-400 bg-red-500/15 border-red-500/40",
  HIGH: "text-amber-400 bg-amber-400/15 border-amber-400/40",
  MEDIUM: "text-blue-300 bg-blue-400/15 border-blue-400/40",
  LOW: "text-white/60 bg-surface border-border",
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40",
  ASSIGNED: "bg-purple-400/20 text-purple-300 border-purple-400/40",
  IN_PROGRESS: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
  AWAITING_PLAYER: "bg-orange-400/20 text-orange-300 border-orange-400/40",
  RESOLVED: "bg-neon-green/20 text-neon-green border-neon-green/40",
  CLOSED: "bg-white/10 text-white/50 border-border",
};

export default function AdminSupport() {
  const [stats, setStats] = useState<any>({});
  const [tickets, setTickets] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [view, setView] = useState<"tickets" | "disputes">("tickets");
  const [filter, setFilter] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [openDisputeId, setOpenDisputeId] = useState<string | null>(null);
  const [disputeDetail, setDisputeDetail] = useState<any>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [disputeSending, setDisputeSending] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const params = filter === "All" ? "" : `?status=${filter}`;
    try {
      const [s, t, u, d] = await Promise.all([
        api("/admin/support/stats"),
        api(`/admin/support/tickets${params}`),
        api("/admin/users"),
        api("/admin/challenges/disputes").catch(() => []),
      ]);
      setStats(s);
      setTickets((t as any).items);
      setAdmins((u as any[]).filter((x) => x.roleRef && ["SUPER_ADMIN", "ADMIN", "SUPPORT", "MODERATOR"].includes(x.roleRef.name)));
      setDisputes(d as any[]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  async function open(id: string) {
    setOpenId(id);
    setOpenDisputeId(null);
    setDisputeDetail(null);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await api(`/admin/support/tickets/${id}`));
    } finally {
      setDetailLoading(false);
    }
  }
  async function openDispute(id: string) {
    setOpenDisputeId(id);
    setOpenId(null);
    setDetail(null);
    setDisputeDetail(null);
    setDisputeLoading(true);
    try {
      setDisputeDetail(await api(`/admin/disputes/${id}`));
    } finally {
      setDisputeLoading(false);
    }
  }
  async function send() {
    if (!reply.trim() || !openId) return;
    setSending(true);
    try {
      await api(`/admin/support/tickets/${openId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: reply, isInternal: internal }),
      });
      setReply("");
      setInternal(false);
      await open(openId);
      await load(false);
    } finally {
      setSending(false);
    }
  }
  async function sendDisputeNote() {
    if (!disputeNote.trim() || !openDisputeId) return;
    setDisputeSending(true);
    try {
      await api(`/admin/disputes/${openDisputeId}/notes`, {
        method: "POST",
        body: JSON.stringify({ message: disputeNote }),
      });
      setDisputeNote("");
      await openDispute(openDisputeId);
    } finally {
      setDisputeSending(false);
    }
  }
  async function resolveDispute(resolution: "CREATOR" | "OPPONENT" | "REFUND") {
    if (!openDisputeId) return;
    const note =
      resolution === "REFUND"
        ? "Support reviewed both sides and refunded the challenge."
        : `Support reviewed both sides and released the win to the ${resolution.toLowerCase()}.`;
    setResolving(resolution);
    try {
      await api(`/admin/disputes/${openDisputeId}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ resolution, note }),
      });
      setOpenDisputeId(null);
      setDisputeDetail(null);
      await load(false);
    } finally {
      setResolving(null);
    }
  }
  async function patch(field: "status" | "priority" | "assign", value: string) {
    if (!openId) return;
    const path = field === "assign" ? "assign" : field;
    const body = field === "assign" ? { assignedTo: value } : { [field]: value };
    setPatching(true);
    try {
      await api(`/admin/support/tickets/${openId}/${path}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await open(openId);
      await load(false);
    } finally {
      setPatching(false);
    }
  }

  const ageHours = (created: string) =>
    Math.floor((Date.now() - new Date(created).getTime()) / 3_600_000);

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Admin</p>
        <h1 className="font-display text-2xl">Support Tickets</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Open" value={stats.open ?? 0} />
          <Stat label="Assigned" value={stats.assigned ?? 0} />
          <Stat label="In Progress" value={stats.inProgress ?? 0} />
          <Stat label="Resolved Today" value={stats.resolvedToday ?? 0} />
          <Stat label="Disputes" value={disputes.length} />
        </div>
      )}

      <div className="flex rounded-lg bg-surface p-1 border border-border max-w-sm">
        <button
          onClick={() => setView("tickets")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${view === "tickets" ? "bg-neon text-black" : "text-white/70"}`}
        >
          Tickets
        </button>
        <button
          onClick={() => setView("disputes")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${view === "disputes" ? "bg-neon text-black" : "text-white/70"}`}
        >
          Disputes
        </button>
      </div>

      {view === "tickets" && (
      <>
      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-md text-xs ${
              filter === s ? "bg-neon text-black" : "bg-surface text-white/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableLoading columns={8} rows={8} />
        ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Category</th><th>Subject</th>
              <th>Priority</th><th>Status</th><th>Assigned</th><th>Age</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} onClick={() => open(t.id)} className="cursor-pointer hover:bg-surface/50">
                <td className="font-mono text-xs">{t.ticketNumber}</td>
                <td>{t.user?.name ?? t.user?.email}</td>
                <td className="text-xs">{t.category}</td>
                <td className="max-w-xs truncate">{t.subject}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded border text-[10px] ${PRIORITY_COLOR[t.priority]}`}>
                    {t.priority}
                  </span>
                </td>
                <td>
                  <span className={`px-2 py-0.5 rounded border text-[10px] ${STATUS_COLOR[t.status]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="text-xs">{admins.find((a) => a.id === t.assignedTo)?.email ?? "—"}</td>
                <td className="text-xs text-white/60">{ageHours(t.createdAt)}h</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={8} className="text-center text-white/40 py-6">No tickets</td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>
      </>
      )}

      {view === "disputes" && (
        <div className="table-wrap">
          {loading ? (
            <TableLoading columns={7} rows={6} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challenge</th><th>Players</th><th>Reason</th><th>Status</th>
                  <th>Prize</th><th>Raised</th><th>Age</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.id} onClick={() => openDispute(d.id)} className="cursor-pointer hover:bg-surface/50">
                    <td>
                      <div className="font-mono text-xs">{d.challenge?.challengeNumber ?? d.challengeId}</div>
                      <div className="max-w-xs truncate text-white/70">{d.challenge?.title ?? "Challenge"}</div>
                    </td>
                    <td className="text-xs">
                      {playerName(d.challenge?.creator)} vs {playerName(d.challenge?.opponent)}
                    </td>
                    <td className="text-xs">{d.reason}</td>
                    <td><span className="px-2 py-0.5 rounded border text-[10px] bg-red-500/15 text-red-300 border-red-500/40">{d.status}</span></td>
                    <td className="text-xs">Rs {d.challenge?.prizeToWinner ?? "—"}</td>
                    <td className="text-xs">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="text-xs text-white/60">{ageHours(d.createdAt)}h</td>
                  </tr>
                ))}
                {disputes.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-white/40 py-6">No open disputes</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {openId && detailLoading && !detail && (
        <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[640px] bg-bg border-l border-border shadow-xl overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Opening Ticket</h3>
            <button onClick={() => { setOpenId(null); setDetail(null); }}><X size={18} /></button>
          </div>
          <div className="mt-4 space-y-3">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      )}

      {openId && detail && (
        <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[640px] bg-bg border-l border-border shadow-xl overflow-y-auto">
          <div className="p-4 border-b border-border flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono text-white/40">{detail.ticketNumber}</div>
              <h3 className="font-display text-lg">{detail.subject}</h3>
              <p className="text-xs text-white/60 mt-1">
                {detail.user?.email} · {detail.user?.profile?.ign ?? "—"}
              </p>
              <div className="mt-2 flex gap-1 text-[10px]">
                <span className={`px-2 py-0.5 rounded border ${STATUS_COLOR[detail.status]}`}>{detail.status}</span>
                <span className={`px-2 py-0.5 rounded border ${PRIORITY_COLOR[detail.priority]}`}>{detail.priority}</span>
                <span className="px-2 py-0.5 rounded bg-surface text-white/70">{detail.category}</span>
              </div>
            </div>
            <button onClick={() => { setOpenId(null); setDetail(null); }}><X size={18} /></button>
          </div>

          <div className="p-4 grid grid-cols-3 gap-2 border-b border-border text-xs">
            <select className="input col-span-1" value={detail.assignedTo ?? ""} onChange={(e) => patch("assign", e.target.value)} disabled={patching}>
              <option value="">— Unassigned —</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.email}</option>)}
            </select>
            <select className="input col-span-1" value={detail.status} onChange={(e) => patch("status", e.target.value)} disabled={patching}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input col-span-1" value={detail.priority} onChange={(e) => patch("priority", e.target.value)} disabled={patching}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {detail.messages.map((m: any) => {
              const fromUser = m.senderId === detail.userId;
              const bot = m.senderRole === "BOT";
              return (
                <div key={m.id} className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm border ${
                    m.isInternal
                      ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-200"
                      : bot
                        ? "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan"
                        : fromUser
                          ? "bg-surface border-border text-white/90"
                          : "bg-neon/15 border-neon/30 text-white"
                  }`}>
                    <div className="text-[10px] text-white/50 mb-1 flex items-center gap-1">
                      {m.isInternal && <ShieldAlert size={10} className="text-yellow-300" />}
                      {m.isInternal ? "Internal note · " : ""}
                      {bot ? "🤖 Bot" : fromUser ? "Player" : m.senderRole} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                    {m.message}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="p-4 border-t border-border space-y-2"
          >
            <textarea
              className="input"
              rows={3}
              placeholder={internal ? "Internal note (not visible to player)" : "Reply to player..."}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Internal note
              </label>
              <button className="btn-primary" type="submit" disabled={sending}>
                <ButtonLoading loading={sending} loadingText="Sending...">
                  <Send size={14} /> Send
                </ButtonLoading>
              </button>
            </div>
          </form>
        </div>
      )}

      {openDisputeId && disputeLoading && !disputeDetail && (
        <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[680px] bg-bg border-l border-border shadow-xl overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Opening Dispute</h3>
            <button onClick={() => { setOpenDisputeId(null); setDisputeDetail(null); }}><X size={18} /></button>
          </div>
          <div className="mt-4 space-y-3">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      )}

      {openDisputeId && disputeDetail && (
        <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[680px] bg-bg border-l border-border shadow-xl overflow-y-auto">
          <div className="p-4 border-b border-border flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono text-white/40">{disputeDetail.challenge?.challengeNumber}</div>
              <h3 className="font-display text-lg flex items-center gap-2">
                <Gavel size={18} className="text-amber-300" /> Challenge Dispute
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Support should review both players, discuss in notes, then release the result.
              </p>
              <div className="mt-2 flex gap-1 text-[10px]">
                <span className="px-2 py-0.5 rounded border bg-red-500/15 text-red-300 border-red-500/40">{disputeDetail.status}</span>
                <span className="px-2 py-0.5 rounded bg-surface text-white/70">{disputeDetail.reason}</span>
              </div>
            </div>
            <button onClick={() => { setOpenDisputeId(null); setDisputeDetail(null); }}><X size={18} /></button>
          </div>

          <div className="p-4 space-y-3 border-b border-border">
            <div className="grid grid-cols-2 gap-2">
              <PlayerBox label="Creator" player={disputeDetail.challenge?.creator} />
              <PlayerBox label="Opponent" player={disputeDetail.challenge?.opponent} />
            </div>
            <div className="card bg-surface/40">
              <p className="label">Issue Raised</p>
              <p className="text-sm text-white/80 mt-1">{disputeDetail.description}</p>
              {disputeDetail.evidenceUrls?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {disputeDetail.evidenceUrls.map((url: string) => (
                    <a key={url} href={url} target="_blank" className="text-xs text-neon-cyan underline">Evidence</a>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button onClick={() => resolveDispute("CREATOR")} className="btn-primary" disabled={!!resolving}>
                <ButtonLoading loading={resolving === "CREATOR"} loadingText="Releasing...">Creator Wins</ButtonLoading>
              </button>
              <button onClick={() => resolveDispute("OPPONENT")} className="btn-primary" disabled={!!resolving || !disputeDetail.challenge?.opponentId}>
                <ButtonLoading loading={resolving === "OPPONENT"} loadingText="Releasing...">Opponent Wins</ButtonLoading>
              </button>
              <button onClick={() => resolveDispute("REFUND")} className="btn-outline" disabled={!!resolving}>
                <ButtonLoading loading={resolving === "REFUND"} loadingText="Refunding...">Refund</ButtonLoading>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2 max-h-[42vh] overflow-y-auto">
            {(disputeDetail.notes ?? []).map((n: any) => (
              <div key={n.id} className={`flex ${n.authorRole === "PLAYER" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm border ${
                  n.authorRole === "PLAYER"
                    ? "bg-surface border-border text-white/90"
                    : "bg-neon/15 border-neon/30 text-white"
                }`}>
                  <div className="text-[10px] text-white/50 mb-1">
                    {n.authorRole === "PLAYER" ? "Player" : "Support"} · {new Date(n.createdAt).toLocaleString()}
                  </div>
                  {n.message}
                </div>
              </div>
            ))}
            {(disputeDetail.notes ?? []).length === 0 && (
              <p className="text-center text-xs text-white/40 py-4">No discussion yet. Ask both players for context before resolving.</p>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendDisputeNote(); }}
            className="p-4 border-t border-border space-y-2"
          >
            <textarea
              className="input"
              rows={3}
              placeholder="Message both players or add support decision notes..."
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
            />
            <div className="flex justify-end">
              <button className="btn-primary" type="submit" disabled={disputeSending}>
                <ButtonLoading loading={disputeSending} loadingText="Sending...">
                  <Send size={14} /> Send Note
                </ButtonLoading>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-xl text-white">{value}</p>
    </div>
  );
}

function playerName(player: any) {
  return player?.profile?.ign ?? player?.name ?? player?.email ?? "Open Slot";
}

function PlayerBox({ label, player }: { label: string; player: any }) {
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-3">
      <p className="label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{playerName(player)}</p>
      <p className="text-xs text-white/50">{player?.email ?? "No opponent yet"}</p>
    </div>
  );
}
