"use client";
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Gamepad2, Swords, Trophy, ShieldCheck, AlertTriangle, X, Clock, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast, handleJoinError } from "@/lib/toast";
import { ButtonLoading, PageLoading } from "@/components/ui";

const REASONS = [
  { val: "SUSPECTED_HACKER", label: "Suspected Hacker" },
  { val: "TEAMING", label: "Teaming" },
  { val: "GLITCH_ABUSE", label: "Glitch Abuse" },
  { val: "WRONG_RESULT", label: "Wrong Result" },
  { val: "DISCONNECTION", label: "Disconnection" },
  { val: "OTHER", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-neon-green/20 text-neon-green border-neon-green/40",
  MATCHED: "bg-amber-400/20 text-amber-300 border-amber-400/40",
  ROOM_SHARED: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40",
  ONGOING: "bg-neon-purple/20 text-neon-purple border-neon-purple/40",
  COMPLETED: "bg-white/10 text-white/70 border-border",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/40",
  DISPUTED: "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse",
};

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [c, setC] = useState<any>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roomSubmitting, setRoomSubmitting] = useState(false);
  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const [resultOutcome, setResultOutcome] = useState<"WIN" | "LOSE" | null>(null);
  const [result, setResult] = useState({
    kills: 0, headshots: 0, gotBooyah: false, screenshotUrl: "", povUrl: "",
  });
  const [dispute, setDispute] = useState({
    reason: "SUSPECTED_HACKER", description: "", evidenceUrls: [""],
  });
  const [room, setRoom] = useState({ roomId: "", password: "" });

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setC(await api(`/challenges/${id}`));
    } catch (e: any) {
      setC(null);
      setLoadError(e?.message ?? "Challenge could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Check for timeout on MATCHED status
  useEffect(() => {
    if (!c || c.status !== "MATCHED" || !c.roomDeadline) return;
    const deadline = new Date(c.roomDeadline).getTime();
    if (Date.now() > deadline) {
      api(`/challenges/${c.id}/check-timeout`, { method: "POST" }).then(() => load());
    }
  }, [c, load]);

  if (loading) return <PageLoading label="Loading challenge..." />;
  if (loadError || !c) {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <h1 className="font-display text-lg text-white">Challenge not available</h1>
          <p className="mt-2 text-sm text-white/60">
            {loadError ?? "This challenge may have been removed or the link is invalid."}
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => router.back()} className="btn-outline flex-1">
              <ArrowLeft size={14} /> Back
            </button>
            <Link href="/challenges" className="btn-primary flex-1">View Challenges</Link>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = user?.id === c.creatorId;
  const isOpponent = user?.id === c.opponentId;
  const isPart = isCreator || isOpponent;
  const myResult = c.results?.find((r: any) => r.userId === user?.id);

  async function join() {
    if (!user) return router.push("/login");
    if (!agreed) return toast.warning("You must agree to the rules first.");
    setJoining(true);
    try {
      await api(`/challenges/${c.id}/join`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Joined! Room details coming soon.");
      setShowRulesModal(false);
      load();
    } catch (e: any) {
      handleJoinError(e, toast);
    } finally {
      setJoining(false);
    }
  }

  async function submitRoom() {
    if (!room.roomId.trim() || !room.password.trim()) {
      return toast.warning("Both Room ID and Password are required.");
    }
    setRoomSubmitting(true);
    try {
      await api(`/challenges/${c.id}/room`, {
        method: "POST",
        body: JSON.stringify(room),
      });
      toast.success("Room shared!");
      setRoom({ roomId: "", password: "" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRoomSubmitting(false);
    }
  }

  async function submitResult() {
    if (!resultOutcome) return toast.warning("Select Win or Lose first.");
    setResultSubmitting(true);
    try {
      await api(`/challenges/${c.id}/result`, {
        method: "POST",
        body: JSON.stringify({
          outcome: resultOutcome,
          kills: result.kills,
          headshots: result.headshots,
          gotBooyah: result.gotBooyah,
          screenshotUrl: result.screenshotUrl || undefined,
          povUrl: result.povUrl || undefined,
        }),
      });
      toast.success("Result submitted.");
      setShowResult(false);
      setResultOutcome(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResultSubmitting(false);
    }
  }

  async function submitDispute() {
    setDisputeSubmitting(true);
    try {
      await api(`/challenges/${c.id}/dispute`, {
        method: "POST",
        body: JSON.stringify({
          reason: dispute.reason,
          description: dispute.description,
          evidenceUrls: dispute.evidenceUrls.filter(Boolean),
        }),
      });
      toast.success("Dispute submitted.");
      setShowDispute(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDisputeSubmitting(false);
    }
  }

  const creatorIgn = c.creator?.profile?.ign ?? c.creator?.name ?? "Creator";
  const opponentIgn = c.opponent?.profile?.ign ?? c.opponent?.name ?? "Opponent";

  return (
    <div className="space-y-3 pb-32">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-purple-700 px-2 py-0.5 text-[10px] font-bold text-white">
            {c.challengeNumber}
          </span>
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[c.status] ?? ""}`}>
            {c.status}
          </span>
        </div>
        <h1 className="mt-2 font-display text-xl text-white">{c.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge>{c.gameMode}</Badge>
          {c.gameMode === "CS" ? (
            <><Badge>{c.csTeamMode}</Badge><Badge>R{c.csRounds}</Badge></>
          ) : c.gameMode === "LW" ? (
            <><Badge>{c.lwTeamMode}</Badge><Badge>LW</Badge></>
          ) : (
            <><Badge>{c.brMap}</Badge><Badge>{c.brWinCondition}</Badge></>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Player ign={creatorIgn} role="Creator" />
          <Swords size={20} className="text-neon-orange" />
          {c.opponent ? (
            <Player ign={opponentIgn} role="Opponent" />
          ) : (
            <div className="text-right">
              <p className="text-xs text-white/50 animate-pulse">Waiting…</p>
            </div>
          )}
        </div>
      </div>

      {/* 10-min Countdown Timer */}
      {c.status === "MATCHED" && c.roomDeadline && (
        <CountdownBanner
          deadline={c.roomDeadline}
          isCreator={isCreator}
          onExpired={() => {
            api(`/challenges/${c.id}/check-timeout`, { method: "POST" }).then(() => load());
          }}
        />
      )}

      {/* Prize */}
      <div className="card">
        <h2 className="font-display text-sm flex items-center gap-1"><Trophy size={14} className="text-neon" /> Prize</h2>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-white/70">Winner Prize</span>
          <span className="font-bold text-neon-green">Rs {c.prizeToWinner}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Entry Fee</span><span>Rs {c.entryFee} each</span>
        </div>
      </div>

      {/* Rules */}
      <RulesSection challenge={c} />

      {/* Room details (visible after share) */}
      {(c.status === "ROOM_SHARED" || c.status === "ONGOING" || c.status === "PENDING_RESULTS")
        && isPart && c.roomId && (
        <div className="card border-neon-cyan/30">
          <h2 className="font-display text-sm text-neon-cyan">Room Details</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Box label="Room ID" value={c.roomId} />
            <Box label="Password" value={c.roomPassword} />
          </div>
          <p className="mt-2 text-[10px] text-white/40">Join the room immediately. Late join = forfeit.</p>
        </div>
      )}

      {/* Creator: share room */}
      {isCreator && c.status === "MATCHED" && (
        <div className="card border-amber-400/30">
          <h2 className="font-display text-sm text-amber-300">Share Room Details</h2>
          <p className="mt-1 text-xs text-white/60">Create a custom room in-game and share the details below.</p>
          <div className="mt-3 space-y-2">
            <input className="input" placeholder="Room ID" value={room.roomId} onChange={(e) => setRoom({ ...room, roomId: e.target.value })} />
            <input className="input" placeholder="Password" value={room.password} onChange={(e) => setRoom({ ...room, password: e.target.value })} />
          </div>
          <button onClick={submitRoom} className="btn-primary mt-3 w-full" disabled={roomSubmitting}>
            <ButtonLoading loading={roomSubmitting} loadingText="Sharing...">
              Share Room
            </ButtonLoading>
          </button>
        </div>
      )}

      {/* Submit / dispute */}
      {isPart && (c.status === "ROOM_SHARED" || c.status === "ONGOING" || c.status === "PENDING_RESULTS" || c.status === "DISPUTED") && (
        <div className="space-y-2">
          <ResultDelayBanner startedAt={c.startedAt} />
          <div className="flex gap-2">
            {!myResult && (
              <ResultSubmitButton startedAt={c.startedAt} onClick={() => setShowResult(true)} />
            )}
            {myResult && (
              <div className="flex-1 rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-2 text-center text-xs text-neon-green">
                {myResult.outcome === "WIN" ? "Claimed WIN" : "Reported LOSE"} ({myResult.kills} kills)
              </div>
            )}
            <button onClick={() => setShowDispute(true)} className="btn-outline flex-1">Dispute</button>
          </div>
        </div>
      )}

      {/* Winner banner */}
      {c.status === "COMPLETED" && c.winnerId && isPart && (
        <div className={`card text-center ${c.winnerId === user?.id ? "border-neon-green/40 bg-neon-green/10" : "border-red-500/30 bg-red-500/5"}`}>
          <p className="text-lg font-bold" style={{ color: c.winnerId === user?.id ? "var(--neon-green, #22c55e)" : "#ef4444" }}>
            {c.winnerId === user?.id ? "You Won!" : "You Lost"}
          </p>
          {c.winnerId === user?.id && (
            <p className="mt-1 text-sm text-white/70">Rs {c.prizeToWinner} credited to your wallet.</p>
          )}
        </div>
      )}

      {/* JOIN button */}
      {!isPart && c.status === "OPEN" && (
        <button
          onClick={() => setShowRulesModal(true)}
          className="fixed bottom-0 left-0 right-0 z-40 mx-auto block w-full max-w-md rounded-t-lg bg-[#E53935] py-4 font-display text-base font-bold text-white shadow-2xl"
        >
          JOIN CHALLENGE · Rs {c.entryFee}
        </button>
      )}

      {/* Rules modal */}
      {showRulesModal && (
        <Modal onClose={() => setShowRulesModal(false)}>
          <h3 className="font-display text-base text-white mb-2">Match Rules</h3>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Box label="You pay" value={`Rs ${c.entryFee}`} />
            <Box label="Winner gets" value={`Rs ${c.prizeToWinner}`} />
            <Box label="Total stake" value={`Rs ${Number(c.entryFee ?? 0) * 2}`} />
            <Box label="Platform fee" value={`Rs ${c.platformFee ?? 0}`} />
          </div>
          <div className="mb-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
            Joining deducts your entry fee immediately. If the creator does not share room details before the deadline, the system refunds the entry fee automatically.
          </div>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-3 text-xs text-white/80">
            {c.rulesText}
          </pre>
          <label className="mt-3 flex items-start gap-2 text-xs text-white/80">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>I agree to all rules above</span>
          </label>
          <button onClick={join} disabled={!agreed || joining} className="mt-3 w-full rounded-lg bg-[#E53935] py-3 font-display text-sm font-bold text-white disabled:opacity-50">
            <ButtonLoading loading={joining} loadingText="Joining...">JOIN · Rs {c.entryFee}</ButtonLoading>
          </button>
        </Modal>
      )}

      {/* Result modal — Win/Lose flow */}
      {showResult && (
        <Modal onClose={() => { setShowResult(false); setResultOutcome(null); }}>
          <h3 className="font-display text-lg text-white mb-3">Submit Result</h3>

          {/* Step 1: Win or Lose */}
          <p className="text-xs text-white/60 mb-2">Did you win or lose this match?</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setResultOutcome("WIN")}
              className={`rounded-xl py-3 text-center font-bold text-sm border-2 transition ${resultOutcome === "WIN" ? "border-green-400 bg-green-400/20 text-green-300" : "border-white/10 bg-white/5 text-white/60"}`}
            >
              🏆 I Won
            </button>
            <button
              onClick={() => setResultOutcome("LOSE")}
              className={`rounded-xl py-3 text-center font-bold text-sm border-2 transition ${resultOutcome === "LOSE" ? "border-red-400 bg-red-400/20 text-red-300" : "border-white/10 bg-white/5 text-white/60"}`}
            >
              ❌ I Lost
            </button>
          </div>

          {/* Step 2: If WIN, show proof fields */}
          {resultOutcome === "WIN" && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <div>
                <label className="text-[11px] font-medium text-white/60">
                  Game history screenshot {c.screenshotRequired && <span className="text-red-400">*required</span>}
                </label>
                <input className="input mt-1" placeholder="Paste game history screenshot URL" value={result.screenshotUrl} onChange={(e) => setResult({ ...result, screenshotUrl: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-white/60">
                  Match proof {c.povRequired && <span className="text-red-400">*required</span>}
                </label>
                <input className="input mt-1" placeholder="Paste proof URL" value={result.povUrl} onChange={(e) => setResult({ ...result, povUrl: e.target.value })} />
              </div>
            </div>
          )}

          {/* Step 2b: If LOSE, just confirm */}
          {resultOutcome === "LOSE" && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-sm text-white/70 text-center">No proof needed. Just confirm your loss below.</p>
            </div>
          )}

          {resultOutcome && (
            <button onClick={submitResult} className="btn-primary mt-4 w-full" disabled={resultSubmitting}>
              <ButtonLoading loading={resultSubmitting} loadingText="Submitting...">
                {resultOutcome === "WIN" ? "Submit Win Claim" : "Confirm Loss"}
              </ButtonLoading>
            </button>
          )}
        </Modal>
      )}

      {/* Dispute modal */}
      {showDispute && (
        <Modal onClose={() => setShowDispute(false)}>
          <h3 className="font-display text-lg text-white mb-2">Raise Dispute</h3>
          <p className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
            False disputes = ban. Provide real proof only.
          </p>
          <select className="input mb-2" value={dispute.reason} onChange={(e) => setDispute({ ...dispute, reason: e.target.value })}>
            {REASONS.map((r) => <option key={r.val} value={r.val}>{r.label}</option>)}
          </select>
          <textarea className="input" rows={3} placeholder="Describe the issue" value={dispute.description} onChange={(e) => setDispute({ ...dispute, description: e.target.value })} />
          {dispute.evidenceUrls.map((url, i) => (
            <input key={i} className="input mt-2" placeholder="Evidence URL" value={url}
              onChange={(e) => { const arr = [...dispute.evidenceUrls]; arr[i] = e.target.value; setDispute({ ...dispute, evidenceUrls: arr }); }} />
          ))}
          <button type="button" onClick={() => setDispute({ ...dispute, evidenceUrls: [...dispute.evidenceUrls, ""] })} className="btn-outline mt-2 text-xs">+ Add URL</button>
          <button onClick={submitDispute} className="btn-primary mt-3 w-full" disabled={disputeSubmitting}>
            <ButtonLoading loading={disputeSubmitting} loadingText="Submitting...">Submit Dispute</ButtonLoading>
          </button>
        </Modal>
      )}
    </div>
  );
}

// --- Countdown Banner ---
function CountdownBanner({ deadline, isCreator, onExpired }: { deadline: string; isCreator: boolean; onExpired: () => void }) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) { setExpired(true); setRemaining("0:00"); onExpired(); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (expired) {
    return (
      <div className="card border-red-500/40 bg-red-500/10 text-center">
        <p className="text-sm font-bold text-red-400">Time expired</p>
        <p className="text-xs text-white/60">Room was not shared in time. Processing refund...</p>
      </div>
    );
  }

  return (
    <div className="card border-amber-400/30 bg-amber-400/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-300" />
          <div>
            <p className="text-xs font-semibold text-amber-300">
              {isCreator ? "Share room before time runs out" : "Waiting for room details"}
            </p>
            <p className="text-[10px] text-white/50">
              {isCreator ? "Create a custom room and share ID + password" : "Creator must share room within deadline"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-bold text-amber-300">{remaining}</p>
          <p className="text-[9px] text-white/40">remaining</p>
        </div>
      </div>
    </div>
  );
}

// --- UI Primitives ---
function RulesSection({ challenge: c }: { challenge: any }) {
  const isCS = c.gameMode === "CS";
  return (
    <div className="card">
      <h2 className="font-display text-sm">MATCH SETTINGS</h2>
      <div className="mt-2 space-y-1 text-xs">
        {isCS ? (
          <>
            <Row label="Team Mode" value={c.csTeamMode} />
            <Row label="Rounds" value={c.csRounds} />
            <Row label="Character Skill" value={c.characterSkill ? "Yes" : "No"} />
            <Row label="Headshot Only" value={c.headshotOnly ? "Yes" : "No"} />
          </>
        ) : c.gameMode === "LW" ? (
          <>
            <Row label="Mode" value={`Lone Wolf ${c.lwTeamMode}`} />
            <Row label="Headshot Only" value={c.headshotOnly ? "Yes" : "No"} />
          </>
        ) : (
          <>
            <Row label="Map" value={c.brMap} />
            <Row label="Mode" value={c.brTeamMode} />
            <Row label="Win Condition" value={c.brWinCondition} accent />
            {c.brTargetKills && <Row label="Target Kills" value={c.brTargetKills} />}
          </>
        )}
        {c.noEmulator && <Row label="No Emulator" value="Yes" />}
        {c.povRequired && <Row label="POV Required" value="Yes" />}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-0.5 text-[10px] text-neon-cyan">{children}</span>;
}
function Player({ ign, role }: { ign: string; role: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neon-purple/20 text-neon-purple">
        <Gamepad2 size={16} />
      </div>
      <p className="mt-1 text-xs text-white max-w-[80px] truncate">{ign}</p>
      <p className="text-[10px] text-white/40">{role}</p>
    </div>
  );
}
function Box({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-neon/40 bg-neon/5 px-2 py-2 text-center">
      <p className="text-[10px] text-white/50">{label}</p>
      <p className="font-mono text-sm font-bold text-neon">{value ?? "—"}</p>
    </div>
  );
}
function Row({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 py-1 last:border-0">
      <span className="text-white/60">{label}</span>
      <span className={accent ? "text-neon font-semibold" : "text-white"}>{value}</span>
    </div>
  );
}
function ResultDelayBanner({ startedAt }: { startedAt?: string | null }) {
  const [remaining, setRemaining] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const DELAY_MINS = 10;

  useEffect(() => {
    if (!startedAt) { setCanSubmit(true); return; }
    const earliest = new Date(new Date(startedAt).getTime() + DELAY_MINS * 60_000);
    const tick = () => {
      const ms = earliest.getTime() - Date.now();
      if (ms <= 0) { setCanSubmit(true); setRemaining(""); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (canSubmit) return null;
  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-amber-300" />
        <span className="text-xs text-amber-200">Result submission opens in</span>
      </div>
      <span className="font-mono text-sm font-bold text-amber-300">{remaining}</span>
    </div>
  );
}

function ResultSubmitButton({ startedAt, onClick }: { startedAt?: string | null; onClick: () => void }) {
  const [canSubmit, setCanSubmit] = useState(false);
  const DELAY_MINS = 10;

  useEffect(() => {
    if (!startedAt) { setCanSubmit(true); return; }
    const earliest = new Date(new Date(startedAt).getTime() + DELAY_MINS * 60_000);
    const check = () => { if (Date.now() >= earliest.getTime()) setCanSubmit(true); };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <button onClick={onClick} disabled={!canSubmit} className={`btn-primary flex-1 ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}>
      {canSubmit ? "Submit Result" : "Waiting..."}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-3 sm:items-center">
      <div className="card relative w-full max-w-md max-h-[85vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-3 top-3 text-white/60"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}
