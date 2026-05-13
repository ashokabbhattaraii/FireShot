"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  GameModeLabels,
  GameModes,
  GameModeMaxTeams,
  GameModeTeamSize,
  calculatePrize,
  getDefaultTournamentType,
  isWinnerTakesAllOnly,
  GAME_MODE_LIMITS,
  formatSlots,
  type PrizeGameMode,
} from "@fireslot/shared";
import { fmtDate, npr } from "@/lib/utils";
import { ButtonLoading, CardSkeleton, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

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

export default function AdminTournaments() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initialForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setItems(await api("/tournaments"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => { load().catch(() => {}); }, []);

  // Live pricing preview
  useEffect(() => {
    const fee = Number(form.entryFeeNpr);
    const slots = Number(form.maxSlots);
    if (!fee || !slots) return setPreview(null);
    const ctrl = new AbortController();
    api(`/tournaments/preview/pricing?entryFee=${fee}&maxPlayers=${slots}`)
      .then(setPreview)
      .catch(() => setPreview(null));
    return () => ctrl.abort();
  }, [form.entryFeeNpr, form.maxSlots]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreating(true);
    try {
      await api("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          entryFeeNpr: Number(form.entryFeeNpr),
          prizePoolNpr: preview?.grossPool ?? 0,
          maxSlots: Number(form.maxSlots),
          maxTeams: form.maxTeams ? Number(form.maxTeams) : undefined,
          minLevel: Number(form.minLevel),
          maxHeadshotRate: Number(form.maxHeadshotRate),
          dateTime: new Date(form.dateTime).toISOString(),
        }),
      });
      setForm(initialForm);
      setOpen(false);
      await load(false);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setActionKey(`${id}:status`);
    try {
      await api(`/tournaments/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await load(false);
    } finally {
      setActionKey(null);
    }
  }

  async function publishRoom(id: string) {
    const roomId = prompt("Room ID?");
    if (!roomId) return;
    const roomPassword = prompt("Room password?");
    if (!roomPassword) return;
    setActionKey(`${id}:room`);
    try {
      await api(`/tournaments/${id}/room`, {
        method: "PUT",
        body: JSON.stringify({ roomId, roomPassword }),
      });
      await load(false);
    } finally {
      setActionKey(null);
    }
  }

  async function lockRoom(id: string) {
    if (!confirm("Lock room and finalize prizes? This sets actualPlayers and recomputes Per Kill / Booyah.")) return;
    setActionKey(`${id}:lock`);
    try {
      await api(`/tournaments/${id}/lock-room`, { method: "POST" });
      await load(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionKey(null);
    }
  }

  async function deleteTournament(id: string) {
    if (!confirm("Are you sure you want to delete this tournament? This action cannot be undone.")) return;
    setActionKey(`${id}:delete`);
    try {
      await api(`/tournaments/${id}`, { method: "DELETE" });
      await load(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionKey(null);
    }
  }

  function applyModeDefaults(mode: string) {
    const teamSize = GameModeTeamSize[mode as keyof typeof GameModeTeamSize] ?? 1;
    const modeMaxTeams = GameModeMaxTeams[mode as keyof typeof GameModeMaxTeams] ?? 2;
    const isTeamBased = teamSize > 1;
    const isFixedTwoTeamMode = mode === "CS_4V4" || mode === "LW_1V1" || mode === "LW_2V2";
    const defaultTeams = isFixedTwoTeamMode ? 2 : modeMaxTeams;
    const defaultType = getDefaultTournamentType(mode);

    setForm((prev: any) => ({
      ...prev,
      mode,
      type: defaultType,
      maxTeams: isTeamBased ? defaultTeams : undefined,
      maxSlots: defaultTeams * teamSize,
    }));
  }

  const typeLocked = isWinnerTakesAllOnly(form.mode);

  const localPreview = useMemo(() => {
    const fee = Number(form.entryFeeNpr);
    const slots = Number(form.maxSlots);
    if (!fee || !slots) return null;
    return calculatePrize({
      entryFee: fee,
      playerCount: slots,
      tournamentType: form.type,
    });
  }, [form.entryFeeNpr, form.maxSlots, form.type]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Tournaments"
        description="Pool scales with actual players. Per Kill and Booyah are auto-computed at room lock."
        action={
          <button onClick={() => setOpen(!open)} className="btn-primary">
            {open ? "Close" : "New"}
          </button>
        }
      />

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
              {(preview || localPreview) && !typeLocked && (
                <span>
                  Per Kill <b className="text-yellow-300">Rs {preview?.perKillReward ?? localPreview?.perKillReward ?? 0}</b> · Booyah <b className="text-neon-cyan">Rs {preview?.booyahPrize ?? localPreview?.booyahPrize ?? 0}</b>
                </span>
              )}
              {typeLocked && localPreview && (
                <span>
                  Winner gets <b className="text-yellow-300">Rs {localPreview.netPool}</b>
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

          {preview && (
            <div className="rounded-lg border border-neon/40 bg-neon/5 p-3 text-sm">
              <p className="label text-neon">If {preview.actualPlayers} players join</p>
              <p className="mt-1 text-white/80">
                Pool <b>{npr(preview.grossPool)}</b> →
                Platform <b>{npr(preview.platformCut)}</b> ({preview.systemFeePercent}%) →
                Net <b>{npr(preview.netPool)}</b>
              </p>
              {(form.mode === "CS_4V4" || form.mode === "LW_1V1" || form.mode === "LW_2V2") ? (
                <p className="mt-1 text-white/80">
                  <b className="text-yellow-300">Winner Takes All:</b> Winning team splits {npr(preview.netPool)} equally
                  {preview.actualPlayers > 0 && (
                    <span> = <b className="text-yellow-300">{npr(Math.floor(preview.netPool / (preview.actualPlayers / 2)))}</b> per winning player</span>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-white/80">
                  Per Kill: <b className="text-neon">{npr(preview.perKillReward)}</b> · Booyah: <b className="text-neon-cyan">{npr(preview.booyahPrize)}</b>
                </p>
              )}
              <p className="mt-1 text-xs text-white/50">{preview.scalingNote}</p>
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
          {msg && <p className="text-sm text-red-400">{msg}</p>}
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
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label">{GameModeLabels[t.mode as keyof typeof GameModeLabels]}</p>
                  <h3 className="font-semibold text-white">{t.title}</h3>
                  <p className="mt-1 text-xs text-white/50">{fmtDate(t.dateTime)}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                <Mini label="Fee" value={npr(t.entryFeeNpr)} />
                <Mini label="Per Kill" value={npr(t.perKillReward ?? 0)} />
                <Mini label="Booyah" value={npr(t.booyahPrize ?? 0)} />
                <Mini
                  label={GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize] > 1 ? "Teams" : "Players"}
                  value={GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize] > 1
                    ? `${Math.floor(t.filledSlots / GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize])}/${t.maxTeams || Math.floor(t.maxSlots / GameModeTeamSize[t.mode as keyof typeof GameModeTeamSize])}`
                    : `${t.filledSlots}/${t.maxSlots}`
                  }
                />
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  className="btn-outline text-xs"
                  onClick={() => publishRoom(t.id)}
                  disabled={actionKey?.startsWith(`${t.id}:`)}
                >
                  <ButtonLoading loading={actionKey === `${t.id}:room`} loadingText="Saving room...">
                    Room
                  </ButtonLoading>
                </button>
                <button
                  className="btn-outline text-xs"
                  onClick={() => lockRoom(t.id)}
                  disabled={t.roomLocked || actionKey?.startsWith(`${t.id}:`)}
                >
                  <ButtonLoading loading={actionKey === `${t.id}:lock`} loadingText="Locking...">
                    {t.roomLocked ? `Locked (${t.actualPlayers})` : "Lock Room"}
                  </ButtonLoading>
                </button>
                <button
                  className="btn-danger text-xs"
                  onClick={() => deleteTournament(t.id)}
                  disabled={actionKey?.startsWith(`${t.id}:`)}
                >
                  <ButtonLoading loading={actionKey === `${t.id}:delete`} loadingText="Deleting...">
                    Delete
                  </ButtonLoading>
                </button>
                <select
                  onChange={(e) => setStatus(t.id, e.target.value)}
                  className="input text-xs flex-1 min-w-[120px]"
                  value={t.status}
                  disabled={actionKey?.startsWith(`${t.id}:`)}
                >
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="LIVE">LIVE</option>
                  <option value="PENDING_RESULTS">PENDING_RESULTS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
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
