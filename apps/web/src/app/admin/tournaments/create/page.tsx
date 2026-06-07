"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import {
  GameModeLabels,
  GameModes,
  GameModeMaxTeams,
  GameModeTeamSize,
  calculatePrize,
  getDefaultTournamentType,
  isWinnerTakesAllOnly,
  TournamentTypeLabels,
} from "@fireslot/shared";
import { npr } from "@/lib/utils";
import { ButtonLoading } from "@/components/ui";

const BANNED_GUNS = ["Double Vector", "M79", "Grenade Launcher", "Rocket Launcher"];

const initialForm = {
  title: "",
  description: "",
  mode: "BR_SOLO",
  map: "Bermuda",
  type: "SOLO_TOP3",
  entryFeeNpr: 15,
  prizePoolNpr: 0,
  maxSlots: 48,
  maxTeams: undefined as number | undefined,
  dateTime: "",
  rules: "",
  minLevel: 40,
  maxHeadshotRate: 70,
  allowEmulator: false,
  characterSkillOn: true,
  gunAttributesOn: false,
  bannedGuns: ["Double Vector", "M79"] as string[],
};

export default function CreateTournamentPage() {
  const router = useRouter();
  const [form, setForm] = useState<any>(initialForm);
  const [preview, setPreview] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Live pricing preview
  useEffect(() => {
    const fee = Number(form.entryFeeNpr);
    const slots = Number(form.maxSlots);
    if (!fee || !slots) return setPreview(null);
    api(`/tournaments/preview/pricing?entryFee=${fee}&maxPlayers=${slots}`)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [form.entryFeeNpr, form.maxSlots]);

  const localPreview = useMemo(() => {
    const fee = Number(form.entryFeeNpr);
    const slots = Number(form.maxSlots);
    if (!fee || !slots) return null;
    return calculatePrize({ entryFee: fee, playerCount: slots, tournamentType: form.type });
  }, [form.entryFeeNpr, form.maxSlots, form.type]);

  const prizePreview = localPreview ?? preview;
  const typeLocked = isWinnerTakesAllOnly(form.mode);
  const isWTA = form.type === "SOLO_1ST" || typeLocked;
  const isPlacement = form.type === "SOLO_TOP3" || form.type === "SQUAD_TOP10";
  const isKill = form.type === "KILL_RACE" || form.type === "COMBO";

  function applyModeDefaults(mode: string) {
    const teamSize = GameModeTeamSize[mode as keyof typeof GameModeTeamSize] ?? 1;
    const modeMaxTeams = GameModeMaxTeams[mode as keyof typeof GameModeMaxTeams] ?? 2;
    const isTeamBased = teamSize > 1;
    const isFixed = mode === "CS_4V4" || mode === "LW_1V1" || mode === "LW_2V2";
    const defaultTeams = isFixed ? 2 : modeMaxTeams;
    setForm((prev: any) => ({
      ...prev,
      mode,
      type: getDefaultTournamentType(mode),
      maxTeams: isTeamBased ? defaultTeams : undefined,
      maxSlots: defaultTeams * teamSize,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreating(true);
    try {
      await api("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          entryFeeNpr: Number(form.entryFeeNpr),
          prizePoolNpr: prizePreview?.grossPool ?? 0,
          maxSlots: Number(form.maxSlots),
          maxTeams: form.maxTeams ? Number(form.maxTeams) : undefined,
          minLevel: Number(form.minLevel),
          maxHeadshotRate: Number(form.maxHeadshotRate),
          dateTime: new Date(form.dateTime).toISOString(),
        }),
      });
      router.push("/admin/tournaments");
    } catch (e: any) {
      setMsg(e.message ?? "Failed to create tournament");
      setCreating(false);
    }
  }

  const teamSize = GameModeTeamSize[form.mode as keyof typeof GameModeTeamSize] ?? 1;
  const isTeamMode = teamSize > 1;
  const isFixed = form.mode === "CS_4V4" || form.mode === "LW_1V1" || form.mode === "LW_2V2";

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back */}
      <Link
        href="/admin/tournaments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
        Tournaments
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create Tournament</h1>
        <p className="mt-1 text-sm text-white/50">
          Prize pool scales with actual players at room lock.
        </p>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100">
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Basic Info</h2>

          <label className="block">
            <span className="label">Title *</span>
            <input
              className="input"
              placeholder="e.g. Friday Night Solo"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>

          <label className="block">
            <span className="label">Map</span>
            <input
              className="input"
              placeholder="Bermuda / Kalahari / Purgatory"
              value={form.map}
              onChange={(e) => setForm({ ...form, map: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Game Mode *</span>
              <select
                className="input"
                value={form.mode}
                onChange={(e) => applyModeDefaults(e.target.value)}
              >
                {GameModes.map((m) => (
                  <option key={m} value={m}>{GameModeLabels[m]}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Tournament Type</span>
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
            </label>
          </div>

          <label className="block">
            <span className="label">Description</span>
            <textarea
              className="input"
              rows={3}
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="label">Date & Time *</span>
            <input
              className="input"
              type="datetime-local"
              value={form.dateTime}
              onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
              required
              min={(() => {
                const now = new Date();
                // datetime-local expects local time in the form YYYY-MM-DDTHH:mm
                now.setSeconds(0, 0);
                const pad = (n: number) => String(n).padStart(2, "0");
                const yyyy = now.getFullYear();
                const mm = pad(now.getMonth() + 1);
                const dd = pad(now.getDate());
                const hh = pad(now.getHours());
                const minutes = pad(now.getMinutes());
                return `${yyyy}-${mm}-${dd}T${hh}:${minutes}`;
              })()}
            />
          </label>
        </section>

        {/* Entry fee + prize preview */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Entry Fee & Prize</h2>

          <div>
            <span className="label">Entry Fee: Rs {form.entryFeeNpr}</span>
            <input
              type="range"
              min={20}
              max={50}
              step={5}
              value={form.entryFeeNpr}
              onChange={(e) => setForm({ ...form, entryFeeNpr: Number(e.target.value) })}
              className="mt-2 w-full accent-yellow-400"
            />
            <div className="mt-1 flex justify-between text-xs text-white/50">
              <span>Rs 20</span>
              <span>Rs 50</span>
            </div>
          </div>

          {/* Slots */}
          {isTeamMode ? (
            isFixed ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                Fixed: 2 teams × {teamSize}v{teamSize} = {2 * teamSize} players
              </div>
            ) : (
              <label className="block">
                <span className="label">Max Teams ({teamSize}v{teamSize})</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams]}
                  value={form.maxTeams ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setForm({ ...form, maxTeams: v, maxSlots: v * teamSize });
                  }}
                />
              </label>
            )
          ) : (
            <label className="block">
              <span className="label">Max Players</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={2}
                max={GameModeMaxTeams[form.mode as keyof typeof GameModeMaxTeams] * teamSize}
                value={form.maxSlots}
                onChange={(e) => setForm({ ...form, maxSlots: Number(e.target.value) })}
              />
            </label>
          )}

          {/* Live prize preview */}
          {prizePreview && (
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-yellow-400/70">
                Prize Preview ({prizePreview.estimatedFor ?? prizePreview.actualPlayers} players)
              </p>
              <p className="text-white/80">
                Pool <b>{npr(prizePreview.grossPool)}</b> → Platform{" "}
                <b>{npr(prizePreview.platformFee ?? prizePreview.platformCut)}</b> ({prizePreview.systemFeePercent ?? 20}%) → Net{" "}
                <b className="text-yellow-300">{npr(prizePreview.netPool)}</b>
              </p>
              {isWTA && (
                <p className="mt-1 text-white/70">
                  Winner gets <b className="text-yellow-300">{npr(prizePreview.netPool)}</b>
                </p>
              )}
              {isPlacement && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(prizePreview.prizeBreakdown ?? []).slice(0, form.type === "SQUAD_TOP10" ? 10 : 3).map((prize: any) => (
                    <div key={prize.rank} className="rounded border border-white/10 bg-black/20 px-3 py-1 text-center text-xs">
                      <p className="text-white/50">{prize.rank}</p>
                      <p className="font-bold text-yellow-300">{npr(prize.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
              {isKill && (
                <p className="mt-1 text-white/70">
                  Per Kill <b className="text-green-400">{npr(prizePreview.perKillReward)}</b> · Booyah{" "}
                  <b className="text-cyan-400">{npr(prizePreview.booyahPrize)}</b>
                </p>
              )}
              {prizePreview.scalingNote && (
                <p className="mt-1 text-xs text-white/40">{prizePreview.scalingNote}</p>
              )}
            </div>
          )}
        </section>

        {/* Eligibility */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Eligibility</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Min FF Level</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.minLevel}
                onChange={(e) => setForm({ ...form, minLevel: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="label">Max Headshot %</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={form.maxHeadshotRate}
                onChange={(e) => setForm({ ...form, maxHeadshotRate: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.allowEmulator}
              onChange={(e) => setForm({ ...form, allowEmulator: e.target.checked })}
            />
            Allow Emulator
          </label>
        </section>

        {/* Room settings */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Room Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.characterSkillOn}
                onChange={(e) => setForm({ ...form, characterSkillOn: e.target.checked })}
              />
              Character Skill
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.gunAttributesOn}
                onChange={(e) => setForm({ ...form, gunAttributesOn: e.target.checked })}
              />
              Gun Attributes
            </label>
          </div>
          <div>
            <span className="label">Banned Guns</span>
            <div className="mt-1 flex flex-wrap gap-2">
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
                    className={`rounded px-2 py-1 text-xs border transition-colors ${
                      active
                        ? "border-red-500/50 bg-red-500/20 text-red-300"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Extra rules */}
        <section className="card">
          <label className="block">
            <span className="label">Extra Rules (optional)</span>
            <textarea
              className="input mt-1"
              rows={3}
              placeholder="Any additional rules for this tournament"
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
            />
          </label>
        </section>

        {/* Sticky submit */}
        <div className="sticky bottom-0 -mx-4 border-t border-white/[0.07] bg-[var(--fs-bg)] px-4 py-4 lg:-mx-6 lg:px-6">
          <div className="flex gap-3">
            <Link href="/admin/tournaments" className="btn-outline flex-1 text-center">
              Cancel
            </Link>
            <button className="btn-primary flex-1" disabled={creating}>
              <ButtonLoading loading={creating} loadingText="Creating...">
                Create Tournament
              </ButtonLoading>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
