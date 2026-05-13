"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFlags } from "@/lib/flags";
import { FeatureDisabledPage } from "@/components/FeatureDisabledPage";
import { Plus, Send, X, Clock, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";
import { ButtonLoading, PageLoading } from "@/components/ui";

const CATEGORIES = [
  { v: "PAYMENT_ISSUE", label: "Payment", icon: "💳" },
  { v: "TOURNAMENT_ISSUE", label: "Tournament", icon: "🏆" },
  { v: "WITHDRAWAL_ISSUE", label: "Withdrawal", icon: "💸" },
  { v: "ACCOUNT_ISSUE", label: "Account", icon: "👤" },
  { v: "RESULT_DISPUTE", label: "Dispute", icon: "⚖️" },
  { v: "GENERAL", label: "General", icon: "💬" },
];

const STATUS_INFO: Record<string, { color: string; bg: string; label: string }> = {
  OPEN: { color: "var(--fs-green)", bg: "var(--fs-green-dim)", label: "Open" },
  ASSIGNED: { color: "#CE93D8", bg: "rgba(156,39,176,0.12)", label: "Assigned" },
  IN_PROGRESS: { color: "var(--fs-amber)", bg: "var(--fs-amber-dim)", label: "In Progress" },
  AWAITING_PLAYER: { color: "var(--fs-gold)", bg: "var(--fs-gold-dim)", label: "Awaiting Reply" },
  RESOLVED: { color: "var(--fs-green)", bg: "var(--fs-green-dim)", label: "Resolved" },
  CLOSED: { color: "var(--fs-text-3)", bg: "rgba(255,255,255,0.04)", label: "Closed" },
};

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  updatedAt: string;
  createdAt: string;
}
interface TicketDetail extends Ticket {
  messages: { id: string; senderId: string; senderRole: string; message: string; createdAt: string; isInternal: boolean }[];
}

export default function SupportPage() {
  const { user, loading: authLoading } = useAuth();
  const { isEnabled } = useFlags();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState({ category: "GENERAL", subject: "", message: "" });

  async function load() {
    setTicketsLoading(true);
    try {
      const r = await api<{ items: Ticket[] }>("/support/tickets");
      setTickets(r.items);
    } finally { setTicketsLoading(false); }
  }
  useEffect(() => { if (user) load().catch(() => {}); }, [user]);

  if (!isEnabled("SUPPORT_ENABLED")) {
    return <FeatureDisabledPage name="Support" />;
  }

  async function loadDetail(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    try { setDetail(await api(`/support/tickets/${id}`)); }
    finally { setDetailLoading(false); }
  }

  async function createTicket() {
    if (!draft.subject || !draft.message) return;
    setCreatingTicket(true);
    try {
      await api("/support/tickets", { method: "POST", body: JSON.stringify(draft) });
      setCreating(false);
      setDraft({ category: "GENERAL", subject: "", message: "" });
      await load();
    } finally { setCreatingTicket(false); }
  }

  async function sendReplyFn() {
    if (!reply.trim() || !openId) return;
    setSendingReply(true);
    try {
      await api(`/support/tickets/${openId}/reply`, { method: "POST", body: JSON.stringify({ message: reply }) });
      setReply("");
      await loadDetail(openId);
    } finally { setSendingReply(false); }
  }

  if (authLoading) return <PageLoading label="Loading..." />;
  if (!user) return <p style={{ color: "var(--fs-text-3)", textAlign: "center", padding: 40 }}>Please sign in to access support.</p>;

  const openTickets = tickets.filter(t => !["RESOLVED", "CLOSED"].includes(t.status));
  const closedTickets = tickets.filter(t => ["RESOLVED", "CLOSED"].includes(t.status));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--fs-text-1)" }}>Help Center</h1>
          <p style={{ fontSize: 12, color: "var(--fs-text-3)", marginTop: 2 }}>Get help with your account, payments, or tournaments</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="fs-btn fs-btn-primary fs-btn-sm"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <QuickAction icon="💳" label="Payment Help" onClick={() => { setDraft({ ...draft, category: "PAYMENT_ISSUE" }); setCreating(true); }} />
        <QuickAction icon="🏆" label="Match Issue" onClick={() => { setDraft({ ...draft, category: "TOURNAMENT_ISSUE" }); setCreating(true); }} />
        <QuickAction icon="💸" label="Withdrawal" onClick={() => { setDraft({ ...draft, category: "WITHDRAWAL_ISSUE" }); setCreating(true); }} />
      </div>

      {/* Active Tickets */}
      {ticketsLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="fs-skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : openTickets.length === 0 && closedTickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)" }}>
          <MessageCircle size={32} style={{ color: "var(--fs-text-3)", margin: "0 auto" }} />
          <p style={{ fontSize: 14, color: "var(--fs-text-2)", marginTop: 12 }}>No support tickets yet</p>
          <p style={{ fontSize: 12, color: "var(--fs-text-3)", marginTop: 4 }}>Open a ticket if you need any help</p>
        </div>
      ) : (
        <>
          {openTickets.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Active ({openTickets.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {openTickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => loadDetail(t.id)} />)}
              </div>
            </div>
          )}
          {closedTickets.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Resolved ({closedTickets.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {closedTickets.slice(0, 5).map(t => <TicketRow key={t.id} ticket={t} onClick={() => loadDetail(t.id)} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Ticket Modal */}
      {creating && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 16 }}>
          <div style={{ background: "var(--fs-surface-1)", borderRadius: 16, width: "100%", maxWidth: 420, padding: 20, border: "0.5px solid var(--fs-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--fs-text-1)" }}>New Support Request</h3>
              <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} style={{ color: "var(--fs-text-3)" }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fs-label">Category</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setDraft({ ...draft, category: c.v })}
                      style={{
                        padding: "10px 6px", borderRadius: 8, fontSize: 11, fontWeight: 600, textAlign: "center",
                        background: draft.category === c.v ? "var(--fs-red-glow)" : "var(--fs-surface-2)",
                        border: draft.category === c.v ? "1px solid var(--fs-red)" : "1px solid var(--fs-border)",
                        color: draft.category === c.v ? "var(--fs-red)" : "var(--fs-text-3)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "block", fontSize: 16, marginBottom: 2 }}>{c.icon}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="fs-label">Subject</label>
                <input className="fs-input" placeholder="Brief description of your issue" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </div>
              <div>
                <label className="fs-label">Details</label>
                <textarea
                  className="fs-input"
                  style={{ height: 100, paddingTop: 12, resize: "none" }}
                  placeholder="Describe your issue in detail. Include transaction IDs, screenshots, or any relevant info."
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                />
              </div>
              <button className="fs-btn fs-btn-primary fs-btn-full" style={{ height: 48 }} onClick={createTicket} disabled={creatingTicket || !draft.subject || !draft.message}>
                <ButtonLoading loading={creatingTicket} loadingText="Submitting...">
                  Submit Request
                </ButtonLoading>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {openId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "var(--fs-bg)" }}>
          {/* Detail Header */}
          <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", display: "flex", alignItems: "center", gap: 12, paddingTop: "calc(var(--fs-safe-top) + 14px)" }}>
            <button onClick={() => { setOpenId(null); setDetail(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, minWidth: 44, minHeight: 44 }}>
              <X size={20} style={{ color: "var(--fs-text-1)" }} />
            </button>
            {detail && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fs-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail.subject}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: "var(--fs-text-3)", fontFamily: "monospace" }}>{detail.ticketNumber}</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: STATUS_INFO[detail.status]?.bg, color: STATUS_INFO[detail.status]?.color }}>
                    {STATUS_INFO[detail.status]?.label ?? detail.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {detailLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="fs-skeleton" style={{ width: 200, height: 40, margin: "0 auto" }} />
              </div>
            ) : detail?.messages.map((m) => {
              const mine = m.senderId === user.id;
              const isBot = m.senderRole === "BOT";
              const isAdmin = m.senderRole === "ADMIN" || m.senderRole === "SUPER_ADMIN";
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: mine ? "var(--fs-red-glow)" : isBot ? "var(--fs-surface-2)" : isAdmin ? "var(--fs-surface-3)" : "var(--fs-surface-2)",
                    border: mine ? "1px solid rgba(229,57,53,0.2)" : "1px solid var(--fs-border)",
                  }}>
                    <p style={{ fontSize: 10, color: "var(--fs-text-3)", marginBottom: 4 }}>
                      {isBot ? "System" : mine ? "You" : "Support Team"} · {new Date(m.createdAt).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--fs-text-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Input */}
          {detail && detail.status !== "CLOSED" && (
            <div style={{ padding: "12px 16px", borderTop: "0.5px solid var(--fs-border)", paddingBottom: "calc(12px + var(--fs-safe-bottom))", background: "var(--fs-surface-1)" }}>
              <form onSubmit={(e) => { e.preventDefault(); sendReplyFn(); }} style={{ display: "flex", gap: 8 }}>
                <input
                  className="fs-input"
                  style={{ flex: 1, height: 44 }}
                  placeholder="Type your message..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button type="submit" className="fs-btn fs-btn-primary" style={{ width: 44, height: 44, padding: 0 }} disabled={sendingReply || !reply.trim()}>
                  {sendingReply ? <span className="animate-pulse">...</span> : <Send size={16} />}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: "14px 8px", borderRadius: 12, cursor: "pointer",
        background: "var(--fs-surface-1)", border: "0.5px solid var(--fs-border)",
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fs-text-2)" }}>{label}</span>
    </button>
  );
}

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const status = STATUS_INFO[ticket.status] ?? STATUS_INFO.OPEN;
  const cat = CATEGORIES.find(c => c.v === ticket.category);
  const timeAgo = getTimeAgo(ticket.updatedAt);

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "14px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer",
        background: "var(--fs-surface-1)", border: "0.5px solid var(--fs-border)",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: status.bg, fontSize: 16, flexShrink: 0 }}>
        {cat?.icon ?? "💬"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.subject}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: status.bg, color: status.color, fontWeight: 600 }}>
            {status.label}
          </span>
          <span style={{ fontSize: 10, color: "var(--fs-text-3)" }}>{timeAgo}</span>
        </div>
      </div>
      <MessageCircle size={16} style={{ color: "var(--fs-text-3)", flexShrink: 0 }} />
    </button>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
