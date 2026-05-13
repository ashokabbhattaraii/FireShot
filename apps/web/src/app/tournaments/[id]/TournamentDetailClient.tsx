"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFlags } from "@/lib/flags";
import { fmtDate } from "@/lib/utils";
import { useToast, handleJoinError } from "@/lib/toast";
import { useTournamentRealtime } from "@/hooks/useTournamentRealtime";
import { ButtonLoading, PageLoading } from "@/components/ui";
import { TeamJoinSection, getTeamSizeFromTournament } from "@/components/TeamJoinSection";
import {
  Trophy, AlertTriangle, Settings, BookOpen, ShieldCheck, X, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface MatchRules {
  entryFee: number;
  perKillReward: number;
  booyahPrize: number;
  booyahNote?: string;
  eligibility: { minLevel: number; maxHeadshotRate: number; noEmulator: boolean };
  strictlyProhibited: string[];
  violation: string;
  roomSettings: { characterSkill: boolean; gunAttributes: boolean; bannedGuns: string[] };
  importantInstructions: string[];
  importantNotes: string[];
  disclaimer: string;
}

export default function TournamentDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isEnabled } = useFlags();
  const toast = useToast();
  const [t, setT] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [showFail, setShowFail] = useState(false);
  const [showRosterForm, setShowRosterForm] = useState(false);
  const [rosterUids, setRosterUids] = useState<string[]>([]);
  const [teammates, setTeammates] = useState<{freefireUid:string;igName:string}[]>([]);
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const url = user ? `/tournaments/${id}/full` : `/tournaments/${id}`;
    setLoadError(null);
    try {
      setT(await api(url));
    } catch (e: any) {
      setT(null);
      setLoadError(e?.message ?? "Tournament could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    setLoading(true);
    load();
    if (user) {
      api(`/tournaments/${id}/eligibility`).then(setEligibility).catch(() => {});
    }
  }, [id, user, load]);

  useEffect(() => {
    if (!t?.mode) return;
    const count = t.mode === "CS_4V4" ? 4 : t.mode === "LW_2V2" ? 2 : t.mode === "LW_1V1" ? 1 : 0;
    setRosterUids(Array.from({ length: count }, () => ""));
  }, [t?.mode]);

  const { roomJustPublished } = useTournamentRealtime(id, {
    onRoomPublished: () => {
      toast.success("Room details are live!");
      load();
    },
    onStatusChanged: () => load(),
  });
  void roomJustPublished;

  async function join(payload?: { playerUids?: string[]; teammates?: {freefireUid:string;igName:string}[] }) {
    if (!user) return router.push("/login");
    if (eligibility && !eligibility.eligible) {
      setShowFail(true);
      return;
    }
    // Validate teammates for BR team modes
    const teamSize = t ? getTeamSizeFromTournament(t) : 1;
    const requiresTeammates = teamSize > 1 && !requiredCaptainRosterCount;
    if (requiresTeammates) {
      const required = teamSize - 1;
      if (teammates.length !== required || teammates.some(tm => !/^\d{9,12}$/.test(tm.freefireUid) || !tm.igName.trim())) {
        toast.error(`Add ${required} valid teammate UID${required > 1 ? "s" : ""} to join`);
        return;
      }
    }
    setJoining(true);
    try {
      const body: any = payload ?? {};
      if (requiresTeammates && !payload?.playerUids) {
        body.teammates = teammates;
      }
      await api(`/tournaments/${id}/join`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setShowRosterForm(false);
      toast.success("Joined! Upload payment proof to confirm.");
      load();
    } catch (e: any) {
      handleJoinError(e, toast);
      if (/level|headshot|emulator|banned|blacklist/i.test(e?.message ?? "")) {
        setShowFail(true);
      }
    } finally {
      setJoining(false);
    }
  }

  const alreadyJoined = !!t?.participants?.some((p: any) => p.userId === user?.id);

  if (loading) return <PageLoading label="Loading tournament..." />;
  if (loadError || !t) {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="fs-card fs-card-body">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--fs-red-glow)" }}>
            <AlertTriangle size={22} style={{ color: "var(--fs-red)" }} />
          </div>
          <h1 className="fs-h3">Tournament not available</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--fs-text-3)" }}>
            {loadError ?? "This tournament may have been removed or the link is invalid."}
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => router.back()} className="fs-btn fs-btn-outline flex-1">Go Back</button>
            <Link href="/tournaments" className="fs-btn fs-btn-primary flex-1">View Tournaments</Link>
          </div>
        </div>
      </div>
    );
  }

  const requiredCaptainRosterCount =
    t.mode === "CS_4V4" ? 4 : t.mode === "LW_2V2" ? 2 : t.mode === "LW_1V1" ? 1 : 0;

  const rules: MatchRules = (t.matchRules as MatchRules) ?? {
    entryFee: t.entryFeeNpr,
    perKillReward: (t.mode === "CS_4V4" || t.mode === "LW_1V1" || t.mode === "LW_2V2") ? 0 : (t.perKillReward ?? 0),
    booyahPrize: (t.mode === "CS_4V4" || t.mode === "LW_1V1" || t.mode === "LW_2V2") ? 0 : (t.booyahPrize ?? 0),
    booyahNote: (t.mode === "CS_4V4" || t.mode === "LW_1V1" || t.mode === "LW_2V2") ? "" : "Scales with actual players",
    eligibility: { minLevel: t.minLevel ?? 40, maxHeadshotRate: t.maxHeadshotRate ?? 70, noEmulator: !t.allowEmulator },
    strictlyProhibited: [],
    violation: "No reward + Instant ban",
    roomSettings: { characterSkill: t.characterSkillOn, gunAttributes: t.gunAttributesOn, bannedGuns: t.bannedGuns ?? [] },
    importantInstructions: [],
    importantNotes: [],
    disclaimer: "FireSlot Nepal reserves the right to change rules, prizes, or take action anytime",
  };

  return (
    <div className="space-y-4 pb-36 -mx-4">
      {/* Banner */}
      <div className="relative">
        {t.coverUrl ? (
          <img src={t.coverUrl} alt="" className="w-full object-cover" style={{ height: '200px' }} />
        ) : (
          <div className="w-full flex items-center justify-center" style={{ height: '200px', background: 'linear-gradient(135deg, var(--fs-surface-2), var(--fs-surface-3))' }}>
            <Trophy size={48} style={{ color: 'var(--fs-text-3)' }} />
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4" style={{ paddingTop: 'calc(var(--fs-safe-top) + 12px)' }}>
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft size={18} style={{ color: 'var(--fs-text-1)' }} />
          </button>
          <span className={`fs-badge ${t.status === 'ONGOING' ? 'fs-badge-green' : t.status === 'COMPLETED' ? 'fs-badge-gray' : 'fs-badge-amber'}`}>
            {t.status}
          </span>
        </div>
      </div>

      <div className="px-4">
        <div className="text-center">
          <h1 className="fs-h1">{t.title}</h1>
          <p className="fs-caption mt-1">{fmtDate(t.dateTime)}</p>
        </div>

        {/* Match Info Chips */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <InfoChip label="Entry" value={`Rs ${rules.entryFee}`} />
           {(t.mode === "CS_4V4" || t.mode === "LW_1V1" || t.mode === "LW_2V2") ? (
             <>
               <InfoChip label="Fee/Team" value={`Rs ${t.entryFeeNpr}`} />
               <InfoChip label="Winner Prize" value={t.prizeStructure?.netPool ? `Rs ${t.prizeStructure.netPool}` : "TBD"} />
             </>
           ) : (
             <>
               <InfoChip label="Per Kill" value={`Rs ${rules.perKillReward}`} />
               <InfoChip label="Booyah" value={`Rs ${rules.booyahPrize}`} />
             </>
           )}
          <InfoChip label="Players" value={`${t.filledSlots}/${t.maxSlots}`} />
        </div>

        {/* Rules Sections */}
        <Section title="ELIGIBILITY" accent="var(--fs-green)" icon={<ShieldCheck size={14} />}>
          <Bullet>Minimum Level {rules.eligibility.minLevel} required</Bullet>
          <Bullet>Headshot rate below {rules.eligibility.maxHeadshotRate}% (BR Career)</Bullet>
          {rules.eligibility.noEmulator && <Bullet>Emulator / PC players not allowed</Bullet>}
        </Section>

        {rules.strictlyProhibited?.length > 0 && (
          <Section title="STRICTLY PROHIBITED" accent="var(--fs-red)" icon={<AlertTriangle size={14} />}>
            {rules.strictlyProhibited.map((line, i) => <Bullet key={i}>{line}</Bullet>)}
            <p className="mt-2 rounded-md px-3 py-2 text-xs font-bold" style={{ background: 'var(--fs-red-glow)', color: 'var(--fs-red)' }}>
              🚫 Violation = {rules.violation}
            </p>
          </Section>
        )}

        <Section title="ROOM SETTINGS" accent="var(--fs-amber)" icon={<Settings size={14} />}>
          <Detail label="Character Skill" value={rules.roomSettings.characterSkill ? "ON" : "OFF"} />
          <Detail label="Gun Attributes" value={rules.roomSettings.gunAttributes ? "ON" : "OFF"} />
          <Detail
            label="Banned Guns"
            value={rules.roomSettings.bannedGuns?.length ? rules.roomSettings.bannedGuns.join(", ") : "None"}
          />
        </Section>

        {rules.importantInstructions?.length > 0 && (
          <Section title="IMPORTANT INSTRUCTIONS" accent="var(--fs-gold)" icon={<BookOpen size={14} />}>
            {rules.importantInstructions.map((line, i) => <Bullet key={i}>{line}</Bullet>)}
          </Section>
        )}

        {rules.importantNotes?.length > 0 && (
          <Section title="IMPORTANT NOTES" accent="var(--fs-gold)" icon={<AlertTriangle size={14} />}>
            {rules.importantNotes.map((line, i) => (
              <p key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--fs-text-2)' }}>
                <span style={{ color: 'var(--fs-amber)' }}>⚠️</span> {line}
              </p>
            ))}
            <p className="mt-3 text-xs font-bold" style={{ color: 'var(--fs-text-1)' }}>{rules.disclaimer}</p>
          </Section>
        )}
      </div>

      {/* Team Member Section for BR_DUO/BR_SQUAD */}
      {getTeamSizeFromTournament(t) > 1 && !requiredCaptainRosterCount && !alreadyJoined && t.status === "UPCOMING" && (
        <div className="px-4">
          <TeamJoinSection tournament={t} onTeammatesChange={setTeammates} />
        </div>
      )}

      {/* Feature flag: joins disabled */}
      {!isEnabled("TOURNAMENT_JOIN_ENABLED") && !alreadyJoined && (
        <div className="px-4 mt-4">
          <div className="fs-card p-4 text-center" style={{ border: "1px solid var(--fs-amber)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--fs-amber)" }}>Joins Temporarily Disabled</p>
            <p className="text-xs mt-1" style={{ color: "var(--fs-text-3)" }}>Tournament joining is currently paused. Check back soon.</p>
          </div>
        </div>
      )}

      {/* Sticky Join Button */}
      <div
        className="fixed left-0 right-0 z-[100] p-4"
        style={{
          bottom: 'calc(64px + var(--fs-safe-bottom))',
          background: 'rgba(11,11,20,0.98)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--fs-border)',
        }}
      >
        <button
          onClick={() => {
            if (requiredCaptainRosterCount > 0) {
              setShowRosterForm(true);
              return;
            }
            void join();
          }}
          disabled={
            joining ||
            t.status !== "UPCOMING" ||
            alreadyJoined ||
            !isEnabled("TOURNAMENT_JOIN_ENABLED") ||
            (getTeamSizeFromTournament(t) > 1 && !requiredCaptainRosterCount && teammates.some(tm => !/^\d{9,12}$/.test(tm.freefireUid) || !tm.igName.trim()))
          }
          className="fs-btn fs-btn-primary fs-btn-full"
          style={{
            height: '50px',
            fontSize: '15px',
            background: alreadyJoined ? 'var(--fs-green)' : undefined,
            opacity: (t.status !== "UPCOMING" && !alreadyJoined) ? 0.5 : 1,
          }}
        >
          <ButtonLoading loading={joining} loadingText="Joining...">
            {alreadyJoined
              ? "Already Joined ✓"
              : t.status !== "UPCOMING"
                ? t.status
                : requiredCaptainRosterCount > 0
                  ? `JOIN TEAM · Rs ${t.entryFeeNpr}/team`
                  : getTeamSizeFromTournament(t) > 1
                    ? `Join with Team (${getTeamSizeFromTournament(t)} players) · Rs ${t.entryFeeNpr}`
                    : `JOIN NOW · Rs ${t.entryFeeNpr}`}
          </ButtonLoading>
        </button>
        {msg && <p className="mt-2 text-center text-xs" style={{ color: 'var(--fs-text-3)' }}>{msg}</p>}
      </div>

      {showFail && eligibility && !eligibility.eligible && (
        <FailModal
          message={eligibility.failMessage ?? msg ?? "Not eligible"}
          onClose={() => setShowFail(false)}
          onView={() => {
            setShowFail(false);
            document
              .querySelector("[data-section='ELIGIBILITY']")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {showRosterForm && requiredCaptainRosterCount > 0 && (
        <RosterUidModal
          mode={t.mode}
          count={requiredCaptainRosterCount}
          uids={rosterUids}
          joining={joining}
          onClose={() => setShowRosterForm(false)}
          onChange={(index, value) => {
            setRosterUids((prev) => prev.map((uid, i) => (i === index ? value : uid)));
          }}
          onSubmit={() => {
            const normalized = rosterUids.map((x) => x.trim()).filter(Boolean);
            if (normalized.length !== requiredCaptainRosterCount) {
              toast.error(`Please enter all ${requiredCaptainRosterCount} UID fields`);
              return;
            }
            const unique = new Set(normalized);
            if (unique.size !== normalized.length) {
              toast.error("Player UIDs must be unique");
              return;
            }
            void join({ playerUids: normalized });
          }}
        />
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center rounded-lg p-2" style={{ background: 'var(--fs-surface-1)', border: '0.5px solid var(--fs-border)' }}>
      <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--fs-text-3)' }}>{label}</p>
      <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--fs-text-1)' }}>{value}</p>
    </div>
  );
}

function Section({
  title, accent, icon, children,
}: { title: string; accent: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="fs-card mt-4 overflow-visible">
      <div className="flex" style={{ borderLeft: `3px solid ${accent}` }}>
        <div className="p-4 w-full">
          <h2 className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--fs-text-2)' }} data-section={title}>
            {icon} {title}
          </h2>
          <div className="mt-2 space-y-1.5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--fs-border)' }}>
      <span className="text-xs" style={{ color: 'var(--fs-text-3)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--fs-text-1)' }}>{value}</span>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs flex gap-2" style={{ color: 'var(--fs-text-2)' }}>
      <span style={{ color: 'var(--fs-green)' }}>•</span>
      <span>{children}</span>
    </p>
  );
}

function FailModal({ message, onClose, onView }: { message: string; onClose: () => void; onView: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="fs-card fs-card-body relative w-full text-center" style={{ maxWidth: '340px' }}>
        <button onClick={onClose} className="absolute right-3 top-3" style={{ color: 'var(--fs-text-3)' }}>
          <X size={18} />
        </button>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--fs-red-glow)' }}>
          <X size={24} style={{ color: 'var(--fs-red)' }} />
        </div>
        <h3 className="fs-h3">Not Eligible</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--fs-text-2)' }}>{message}</p>
        <button onClick={onView} className="fs-btn fs-btn-outline fs-btn-full mt-4">
          View Requirements
        </button>
      </div>
    </div>
  );
}

function RosterUidModal({
  mode,
  count,
  uids,
  joining,
  onClose,
  onChange,
  onSubmit,
}: {
  mode: string;
  count: number;
  uids: string[];
  joining: boolean;
  onClose: () => void;
  onChange: (index: number, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)" }}>
      <div className="fs-card fs-card-body relative w-full" style={{ maxWidth: "420px" }}>
        <button onClick={onClose} className="absolute right-3 top-3" style={{ color: "var(--fs-text-3)" }}>
          <X size={18} />
        </button>
        <h3 className="fs-h3">Enter Team UIDs</h3>
        <p className="mt-1 text-xs" style={{ color: "var(--fs-text-2)" }}>
          {mode} requires {count} player UID{count > 1 ? "s" : ""}. Include your own UID in player 1.
        </p>
        <div className="mt-2 rounded-md px-3 py-2 text-xs" style={{ background: "var(--fs-surface-2)", border: "1px solid var(--fs-border)" }}>
          <p style={{ color: "var(--fs-text-2)" }}>
            You pay <strong style={{ color: "var(--fs-text-1)" }}>1 fee for the whole team</strong>.
            If your team wins, you (the captain) receive the entire prize pool.
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <input
              key={i}
              className="input"
              placeholder={`Player ${i + 1} UID${i === 0 ? " (Captain)" : ""}`}
              value={uids[i] ?? ""}
              onChange={(e) => onChange(i, e.target.value)}
              autoComplete="off"
            />
          ))}
        </div>

        <button onClick={onSubmit} className="fs-btn fs-btn-primary fs-btn-full mt-4" disabled={joining}>
          <ButtonLoading loading={joining} loadingText="Joining...">Confirm Join</ButtonLoading>
        </button>
      </div>
    </div>
  );
}
