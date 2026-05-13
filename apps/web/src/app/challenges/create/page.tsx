"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast, handleJoinError } from "@/lib/toast";
import { ButtonLoading, PageHeader } from "@/components/ui";

type GameMode = "BR" | "CS" | "LW";

const CS_TEAM_MODES = ["1v1", "2v2", "3v3", "4v4"];
const LW_TEAM_MODES = ["1v1", "2v2"];
const CS_WEAPONS = [
  "NONE", "MP40", "UMP", "MP5", "BIZON", "VECTOR", "M1014", "M1887",
  "MAG7", "M590", "AWM", "XM8", "D-EAGLE", "WOODPECKER",
];
const CS_ARMOURS = [
  { val: "NONE", label: "None" },
  { val: "VEST_LV2", label: "Vest lvl2" },
  { val: "VEST_LV3", label: "Vest lvl3" },
  { val: "VEST_LV4", label: "Vest lvl4" },
  { val: "HELMET_LV2", label: "Helmet lvl2" },
  { val: "HELMET_LV3", label: "Helmet lvl3" },
];

type ChallengeMode = Exclude<GameMode, "BR">;

export default function CreateChallengePage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [gameMode, setGameMode] = useState<ChallengeMode>("CS");
  const [entryFee, setEntryFee] = useState(15);
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [csTeamMode, setCsTeamMode] = useState("1v1");
  const [csThrowable, setCsThrowable] = useState(true);
  const [characterSkill, setCharacterSkill] = useState(true);
  const [gunAttribute, setGunAttribute] = useState(false);
  const [headshotOnly, setHeadshotOnly] = useState(false);
  const [csRounds, setCsRounds] = useState<7 | 13>(7);
  const [csCoins, setCsCoins] = useState<"DEFAULT" | "9980">("DEFAULT");
  const [csLoadout, setCsLoadout] = useState(false);
  const [csCompulsoryWeapon, setCsCompulsoryWeapon] = useState("NONE");
  const [csCompulsoryArmour, setCsCompulsoryArmour] = useState("NONE");
  const [lwTeamMode, setLwTeamMode] = useState("1v1");

  const [showElig, setShowElig] = useState(false);
  const [showAntiCheat, setShowAntiCheat] = useState(false);
  const [minLevel, setMinLevel] = useState(0);
  const [noEmulator, setNoEmulator] = useState(true);
  const [povRequired, setPovRequired] = useState(true);
  const [screenshotRequired, setScreenshotRequired] = useState(true);
  const [reportWindowMins, setReportWindowMins] = useState(60);

  const [submitting, setSubmitting] = useState(false);

  const csPlayerCount = useMemo(() => {
    if (gameMode !== "CS") return 2;
    const size = csTeamMode === "4v4" ? 4 : csTeamMode === "2v2" ? 2 : 1;
    return size * 2;
  }, [gameMode, csTeamMode]);

  const prizeToWinner = useMemo(() => {
    const players = gameMode === "CS" ? csPlayerCount : 2;
    return Math.floor(entryFee * players * 0.8);
  }, [entryFee, gameMode, csPlayerCount]);

  const igName = user?.profile?.ign ?? user?.name ?? user?.email ?? "Player";
  const modeTitle = gameMode === "CS" ? "Clash Squad" : "Lone Wolf";
  const modeDescription =
    gameMode === "CS"
      ? "Fast, team-based fights with tighter round control."
      : "Small-format duels with the cleanest ruleset.";
  const totalPlayers = gameMode === "CS" ? csPlayerCount : 2;

  async function submit() {
    if (!user) return router.push("/login");
    setSubmitting(true);
    try {
      const payload: any = {
        title: title || `${igName}'s ${gameMode} Match`,
        gameMode,
        entryFee,
        isPrivate,
        characterSkill,
        gunAttribute,
        headshotOnly,
        noEmulator,
        minLevel,
        povRequired,
        screenshotRequired,
        reportWindowMins,
      };
      if (gameMode === "CS") {
        Object.assign(payload, {
          csTeamMode,
          csRounds,
          csCoins,
          csThrowable,
          csLoadout,
          csCompulsoryWeapon,
          csCompulsoryArmour,
        });
      } else if (gameMode === "LW") {
        Object.assign(payload, {
          lwTeamMode,
        });
      }
      const created: any = await api("/challenges", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`Challenge ${created.challengeNumber} created!`);
      router.push(`/challenges/${created.id}`);
    } catch (e: any) {
      handleJoinError(e, toast);
    } finally {
      setSubmitting(false);
    }
  }

  const [step, setStep] = useState<"configure" | "confirm">("configure");

  if (step === "confirm") {
    return (
      <div className="mx-auto max-w-md pb-24">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(21,14,41,0.98),rgba(12,9,24,0.98))] p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Confirm & Create</p>
              <h2 className="mt-1 break-words text-lg font-bold text-white">{title || `${igName}'s ${modeTitle}`}</h2>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <PreviewRow label="Mode" value={modeTitle} />
            <PreviewRow label="Entry fee" value={`Rs ${entryFee}`} />
            <PreviewRow label="Winner gets" value={`Rs ${prizeToWinner}`} accent />
            <PreviewRow label="Visibility" value={isPrivate ? "Private" : "Public"} />
            <PreviewRow label="Players" value={`${totalPlayers}`} />
          </div>

          <div className="mt-4 rounded-xl border border-white/8 bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2">Rules</p>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-white/70">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">{gameMode}</span>
              {gameMode === "CS" && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">{csTeamMode}</span>}
              {gameMode === "CS" && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">R{csRounds}</span>}
              {gameMode === "LW" && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">{lwTeamMode}</span>}
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">{isPrivate ? "Invite only" : "Open"}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">Lvl {minLevel || "Any"}</span>
              {noEmulator && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">No emu</span>}
              {povRequired && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">POV req</span>}
              {screenshotRequired && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">SS req</span>}
            </div>
          </div>

          <p className="mt-4 text-xs text-white/50 text-center">
            Rs {entryFee} will be deducted from your wallet immediately.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => setStep("configure")} className="btn-outline">Back</button>
            <button onClick={submit} disabled={submitting} className="btn-primary">
              <ButtonLoading loading={submitting} loadingText="Creating...">
                Create
              </ButtonLoading>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div style={{ marginBottom: 16 }}>
        <h1 className="text-lg font-bold" style={{ color: "var(--fs-text-1)" }}>Create Challenge</h1>
        <p className="text-xs" style={{ color: "var(--fs-text-3)", marginTop: 2 }}>
          {modeTitle} · Rs {entryFee} entry · Winner gets Rs {prizeToWinner}
        </p>
      </div>

      <div className="space-y-4">
          <SectionCard
            title="Match blueprint"
            description="Set the room title, wallet cost, and visibility before configuring the ruleset."
          >
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}
            >
              <div className="md:col-span-2">
                <label className="label mb-2 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${igName}'s ${modeTitle} room`}
                  className="input"
                />
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <label className="label mb-2 block">Entry fee</label>
                <input
                  type="range"
                  min={20}
                  max={50}
                  step={5}
                  value={entryFee}
                  onChange={(e) => setEntryFee(Number(e.target.value))}
                  className="w-full accent-[#E53935]"
                />
                <div className="mt-2 flex flex-col gap-1 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
                  <span>Rs {entryFee}</span>
                  <span className="text-[#FFD166]">Winner preview Rs {prizeToWinner}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <label className="label mb-2 block">Visibility</label>
                <button
                  type="button"
                  onClick={() => setIsPrivate((v) => !v)}
                  className={`flex w-full flex-col items-start gap-2 rounded-xl border px-4 py-3 text-sm transition sm:flex-row sm:items-center sm:justify-between ${
                    isPrivate
                      ? "border-[#E53935]/50 bg-[#E53935]/10 text-white"
                      : "border-white/10 bg-black/20 text-white/70"
                  }`}
                >
                  <span>{isPrivate ? "Private invite-only room" : "Public room"}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                    {isPrivate ? "Locked" : "Open"}
                  </span>
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Game mode"
            description="Challenges support Clash Squad and Lone Wolf only. Battle Royale stays available in tournaments created by system admins."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={gameMode === "CS"}
                title="Clash Squad"
                subtitle="Round-based, weapon-limited team room"
                onClick={() => setGameMode("CS")}
              />
              <ModeCard
                active={gameMode === "LW"}
                title="Lone Wolf"
                subtitle="Fast duels with minimal setup"
                onClick={() => setGameMode("LW")}
              />
            </div>
          </SectionCard>

          {gameMode === "CS" ? (
            <SectionCard title="Clash Squad rules" description="Tuned for round-based team fights.">
              <div className="grid gap-4 md:grid-cols-2">
                <ChoiceGroup label="Team Mode">
                  {CS_TEAM_MODES.map((m) => (
                    <ChoiceButton key={m} active={csTeamMode === m} onClick={() => setCsTeamMode(m)}>
                      {m}
                    </ChoiceButton>
                  ))}
                </ChoiceGroup>

                <ChoiceGroup label="Rounds">
                  {([7, 13] as const).map((rounds) => (
                    <ChoiceButton key={rounds} active={csRounds === rounds} onClick={() => setCsRounds(rounds)}>
                      {rounds}
                    </ChoiceButton>
                  ))}
                </ChoiceGroup>

                <ChoiceGroup label="Coins">
                  {(["DEFAULT", "9980"] as const).map((coin) => (
                    <ChoiceButton key={coin} active={csCoins === coin} onClick={() => setCsCoins(coin)}>
                      {coin === "DEFAULT" ? "Default" : coin}
                    </ChoiceButton>
                  ))}
                </ChoiceGroup>

                <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
                  <ToggleCard label="Throwable limit" value={csThrowable} onChange={setCsThrowable} />
                  <ToggleCard label="Character skill" value={characterSkill} onChange={setCharacterSkill} />
                  <ToggleCard label="Gun attribute" value={gunAttribute} onChange={setGunAttribute} />
                  <ToggleCard label="Headshot only" value={headshotOnly} onChange={setHeadshotOnly} reversed />
                  <ToggleCard label="Loadout lock" value={csLoadout} onChange={setCsLoadout} />
                </div>

                <ChoiceGroup label="Compulsory Weapon" className="md:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {CS_WEAPONS.map((w) => (
                      <ChoiceButton key={w} active={csCompulsoryWeapon === w} onClick={() => setCsCompulsoryWeapon(w)}>
                        {w === "NONE" ? "None" : w}
                      </ChoiceButton>
                    ))}
                  </div>
                </ChoiceGroup>

                <ChoiceGroup label="Compulsory Armour" className="md:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {CS_ARMOURS.map((a) => (
                      <ChoiceButton key={a.val} active={csCompulsoryArmour === a.val} onClick={() => setCsCompulsoryArmour(a.val)}>
                        {a.label}
                      </ChoiceButton>
                    ))}
                  </div>
                </ChoiceGroup>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Lone Wolf rules" description="Keep it simple for duels or small pair matches.">
              <ChoiceGroup label="Team Mode">
                <div className="grid gap-2 sm:grid-cols-2">
                  {LW_TEAM_MODES.map((m) => (
                    <ChoiceButton key={m} active={lwTeamMode === m} onClick={() => setLwTeamMode(m)}>
                      {m}
                    </ChoiceButton>
                  ))}
                </div>
              </ChoiceGroup>
              <p className="mt-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/65">
                Lone Wolf rooms are tuned for direct head-to-head play. Keep the rest of the rules minimal so players can join quickly.
              </p>
            </SectionCard>
          )}

          <SectionCard
            title="Eligibility"
            description="Control who can enter. These limits show up before players join."
          >
            <div className="space-y-4">
              <ChoiceGroup label="Min level">
                <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                  {[0, 20, 30, 40, 50, 60].map((v) => (
                    <ChoiceButton key={v} active={minLevel === v} onClick={() => setMinLevel(v)}>
                      {v === 0 ? "Any" : v}
                    </ChoiceButton>
                  ))}
                </div>
              </ChoiceGroup>
              <ToggleCard label="No emulator" value={noEmulator} onChange={setNoEmulator} />
            </div>
          </SectionCard>

          <SectionCard
            title="Anti-cheat"
            description="Add proof requirements before results can be resolved."
          >
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleCard label="POV required" value={povRequired} onChange={setPovRequired} />
                <ToggleCard label="Screenshot required" value={screenshotRequired} onChange={setScreenshotRequired} />
              </div>
              <ChoiceGroup label="Report window">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[30, 60, 120].map((v) => (
                    <ChoiceButton key={v} active={reportWindowMins === v} onClick={() => setReportWindowMins(v)}>
                      {v === 60 ? "1 hour" : v === 120 ? "2 hours" : `${v} min`}
                    </ChoiceButton>
                  ))}
                </div>
              </ChoiceGroup>
            </div>
          </SectionCard>

        {/* Review button */}
        <button
          onClick={() => setStep("confirm")}
          className="btn-primary w-full"
        >
          Review &amp; Create · Rs {entryFee}
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/8 bg-[#111126] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)] sm:rounded-[24px] sm:p-5">
      <div className="mb-4">
        <p className="label">{title}</p>
        {description && <p className="mt-1 text-sm text-white/55">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#111126] p-3 text-center">
      <p className="text-[9px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function ChoiceGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
        active
          ? "border-[#E53935]/60 bg-[#E53935]/12 text-white shadow-[0_0_0_1px_rgba(229,57,53,0.2)]"
          : "border-white/8 bg-white/5 text-white/72 hover:border-white/15 hover:bg-white/8"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleCard({
  label,
  value,
  onChange,
  reversed = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  reversed?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="label mb-0">{label}</span>
        <span className={`text-xs ${value ? "text-neon-green" : "text-white/45"}`}>
          {value ? "Enabled" : "Disabled"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {reversed ? (
          <>
            <ChoiceButton active={!value} onClick={() => onChange(false)}>No</ChoiceButton>
            <ChoiceButton active={value} onClick={() => onChange(true)}>Yes</ChoiceButton>
          </>
        ) : (
          <>
            <ChoiceButton active={value} onClick={() => onChange(true)}>Yes</ChoiceButton>
            <ChoiceButton active={!value} onClick={() => onChange(false)}>No</ChoiceButton>
          </>
        )}
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
      <span className="text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      <span className={`text-sm font-semibold ${accent ? "text-[#FFD166]" : "text-white"}`}>{value}</span>
    </div>
  );
}

function ModeCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-4 text-left transition ${
        active
          ? "border-[#E53935]/60 bg-[linear-gradient(180deg,rgba(229,57,53,0.18),rgba(17,17,38,0.95))] text-white shadow-[0_18px_40px_rgba(229,57,53,0.15)]"
          : "border-white/8 bg-white/5 text-white/70 hover:border-white/15 hover:bg-white/8"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-white/55">{subtitle}</p>
    </button>
  );
}
