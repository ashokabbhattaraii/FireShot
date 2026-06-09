"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFlags } from "@/lib/flags";
import { subscribeToTicket } from "@/lib/realtime";
import { FeatureDisabledPage } from "@/components/FeatureDisabledPage";
import { Plus, Send, X, Clock, CheckCircle, AlertCircle, MessageCircle, ArrowLeft } from "lucide-react";
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
  OPEN: { color: "#00C853", bg: "rgba(0,200,83,0.12)", label: "Open" },
  ASSIGNED: { color: "#CE93D8", bg: "rgba(156,39,176,0.12)", label: "Assigned" },
  IN_PROGRESS: { color: "#FF8F00", bg: "rgba(255,143,0,0.12)", label: "In Progress" },
  AWAITING_PLAYER: { color: "#FFD700", bg: "rgba(255,215,0,0.15)", label: "Awaiting Reply" },
  RESOLVED: { color: "#00C853", bg: "rgba(0,200,83,0.12)", label: "Resolved" },
  CLOSED: { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.04)", label: "Closed" },
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

  // Subscribe to realtime messages for the open ticket
  const unsubRef = useRef<() => void>();
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = undefined;
    if (!openId) return;
    unsubRef.current = subscribeToTicket(openId, (msg) => {
      setDetail((prev) => {
        if (!prev) return prev;
        const exists = prev.messages.some((m) => m.id === msg.id);
        if (exists) return prev;
        return { ...prev, messages: [...prev.messages, { ...msg, isInternal: false }] };
      });
    });
    return () => { unsubRef.current?.(); };
  }, [openId]);

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
  if (!user) return <p className="text-center text-white/50 py-16">Please sign in to access support.</p>;

  const openTickets = tickets.filter(t => !["RESOLVED", "CLOSED"].includes(t.status));
  const closedTickets = tickets.filter(t => ["RESOLVED", "CLOSED"].includes(t.status));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-white">Help Center</h1>
          <p className="text-xs text-white/50 mt-1">Get support with your account, payments, or tournaments</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="fs-btn fs-btn-primary fs-btn-sm rounded-xl"
        >
          <Plus size={14} /> Open Ticket
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <QuickAction icon="💳" label="Payment" onClick={() => { setDraft({ ...draft, category: "PAYMENT_ISSUE" }); setCreating(true); }} />
        <QuickAction icon="🏆" label="Tournaments" onClick={() => { setDraft({ ...draft, category: "TOURNAMENT_ISSUE" }); setCreating(true); }} />
        <QuickAction icon="💸" label="Withdrawals" onClick={() => { setDraft({ ...draft, category: "WITHDRAWAL_ISSUE" }); setCreating(true); }} />
      </div>

      {/* Active Tickets */}
      {ticketsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="fs-skeleton h-16 rounded-2xl" />)}
        </div>
      ) : openTickets.length === 0 && closedTickets.length === 0 ? (
        <div className="text-center py-10 rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/30">
            <MessageCircle size={24} />
          </div>
          <p className="text-sm font-semibold text-white/80">No support tickets open</p>
          <p className="text-xs text-white/40 mt-1">Submit a ticket and our staff will respond promptly.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {openTickets.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                Active Requests ({openTickets.length})
              </p>
              <div className="space-y-2">
                {openTickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => loadDetail(t.id)} />)}
              </div>
            </div>
          )}
          {closedTickets.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                Closed / Resolved ({closedTickets.length})
              </p>
              <div className="space-y-2">
                {closedTickets.slice(0, 5).map(t => <TicketRow key={t.id} ticket={t} onClick={() => loadDetail(t.id)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Ticket Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
              <h3 className="text-base font-extrabold text-white">Create Support Ticket</h3>
              <button onClick={() => setCreating(false)} className="p-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="fs-label">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setDraft({ ...draft, category: c.v })}
                      className={`p-2 rounded-xl text-[10px] font-bold text-center border transition-all duration-200 ${
                        draft.category === c.v
                          ? "bg-[#E53935]/10 border-[#E53935] text-[#E53935]"
                          : "bg-[#16162a] border-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      <span className="block text-lg mb-1">{c.icon}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="fs-label">Subject</label>
                <input
                  className="input"
                  placeholder="e.g. eSewa transfer not credited"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>
              <div>
                <label className="fs-label">Details</label>
                <textarea
                  className="input min-h-[90px] py-2.5 resize-none"
                  placeholder="Describe your issue in detail. If applicable, specify amount, timing, reference ID."
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                />
              </div>
              <button
                className="fs-btn fs-btn-primary fs-btn-full rounded-xl text-xs h-11"
                onClick={createTicket}
                disabled={creatingTicket || !draft.subject || !draft.message}
              >
                <ButtonLoading loading={creatingTicket} loadingText="Creating ticket...">
                  Submit Ticket
                </ButtonLoading>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Full Screen Modal */}
      {openId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0B14]">
          {/* Detail Header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 bg-[#111126]/95 backdrop-blur-md sticky top-0 z-10 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
            <button
              onClick={() => { setOpenId(null); setDetail(null); }}
              className="p-1 hover:bg-white/5 rounded-lg text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            {detail && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white leading-tight">{detail.subject}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-white/40 font-mono tracking-wide">{detail.ticketNumber}</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      backgroundColor: STATUS_INFO[detail.status]?.bg,
                      color: STATUS_INFO[detail.status]?.color
                    }}
                  >
                    {STATUS_INFO[detail.status]?.label ?? detail.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Messages Grid */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-[#0B0B14] to-[#121226]">
            {detailLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="fs-skeleton w-32 h-4 mx-auto rounded-full" />
                <div className="fs-skeleton w-44 h-8 mx-auto rounded-full" />
              </div>
            ) : (
              detail?.messages.map((m) => {
                const mine = m.senderId === user.id;
                const isBot = m.senderRole === "BOT";
                const isAdmin = m.senderRole === "ADMIN" || m.senderRole === "SUPER_ADMIN";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                        mine
                          ? "bg-[#E53935]/15 border border-[#E53935]/25 text-white rounded-br-none shadow-[0_4px_16px_rgba(229,57,53,0.1)]"
                          : isBot
                            ? "bg-[#16162a] border border-white/5 text-white/90 rounded-bl-none"
                            : isAdmin
                              ? "bg-[#1e1e38] border border-white/10 text-white rounded-bl-none shadow-[0_4px_16px_rgba(255,255,255,0.05)]"
                              : "bg-[#16162a] border border-white/5 text-white rounded-bl-none"
                      }`}
                    >
                      <div className="flex justify-between items-baseline gap-4 mb-1">
                        <span className={`text-[9px] font-bold ${mine ? "text-[#E53935]" : isBot ? "text-white/40" : "text-emerald-400"}`}>
                          {isBot ? "System Assistant" : mine ? "You" : "Support Agent"}
                        </span>
                        <span className="text-[8px] text-white/30 font-medium">
                          {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">{m.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply Box input */}
          {detail && detail.status !== "CLOSED" && (
            <div className="p-4 border-t border-white/5 bg-[#111126] pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              <form
                onSubmit={(e) => { e.preventDefault(); sendReplyFn(); }}
                className="flex gap-2"
              >
                <input
                  className="input flex-1 h-11"
                  placeholder="Type a message..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  type="submit"
                  className="fs-btn fs-btn-primary rounded-xl w-11 h-11 p-0 shrink-0"
                  disabled={sendingReply || !reply.trim()}
                >
                  {sendingReply ? (
                    <span className="animate-pulse font-bold">...</span>
                  ) : (
                    <Send size={15} />
                  )}
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
      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] hover:bg-white/[0.01] transition-all duration-200"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] font-bold text-white/70">{label}</span>
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
      className="flex items-center gap-3.5 w-full p-3.5 rounded-2xl border border-white/5 bg-gradient-to-r from-[#13132a] to-[#0f0f1f] hover:border-white/10 text-left transition-all duration-200"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
        style={{ backgroundColor: status.bg }}
      >
        {cat?.icon ?? "💬"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white leading-snug">{ticket.subject}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-bold"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
          <span className="text-[9px] text-white/40 font-medium flex items-center gap-1">
            <Clock size={10} />
            {timeAgo}
          </span>
        </div>
      </div>
      <MessageCircle size={15} className="text-white/30 shrink-0" />
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
