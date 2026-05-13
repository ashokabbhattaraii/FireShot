"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ButtonLoading, CardSkeleton } from "@/components/ui";

interface Win {
  id: string;
  label: string;
  windowStart: string;
  windowEnd: string;
  prizePool: number;
  maxWinners: number;
  daysOfWeek: number[];
  isActive: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulePage() {
  const [items, setItems] = useState<Win[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    label: "Morning Free",
    windowStart: "06:00",
    windowEnd: "08:00",
    prizePool: 100,
    maxWinners: 1,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
  });

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setItems(await api<Win[]>("/admin/schedule"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  async function create() {
    setCreating(true);
    try {
      await api("/admin/schedule", { method: "POST", body: JSON.stringify(draft) });
      setMsg("Created");
      await load(false);
    } catch (e: any) { setMsg(e.message); }
    finally { setCreating(false); }
  }

  async function patch(id: string, dto: Partial<Win>) {
    setActingKey(`${id}:patch`);
    try {
      await api(`/admin/schedule/${id}`, { method: "PUT", body: JSON.stringify(dto) });
      await load(false);
    } catch (e: any) { setMsg(e.message); }
    finally { setActingKey(null); }
  }

  async function remove(id: string) {
    if (!confirm("Delete window?")) return;
    setActingKey(`${id}:delete`);
    try {
      await api(`/admin/schedule/${id}`, { method: "DELETE" });
      await load(false);
    } finally {
      setActingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Free Daily Windows</h1>
        {msg && <span className="text-xs text-white/70">{msg}</span>}
      </div>

      <div className="card">
        <h2 className="font-display text-lg">New Window</h2>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Label">
            <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Start (HH:MM)">
            <input className="input" value={draft.windowStart} onChange={(e) => setDraft({ ...draft, windowStart: e.target.value })} />
          </Field>
          <Field label="End (HH:MM)">
            <input className="input" value={draft.windowEnd} onChange={(e) => setDraft({ ...draft, windowEnd: e.target.value })} />
          </Field>
          <Field label="Prize Pool">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              value={draft.prizePool}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setDraft({ ...draft, prizePool: digits ? Number(digits) : 0 });
              }}
            />
          </Field>
          <Field label="Max Winners">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              value={draft.maxWinners}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const next = digits ? Number(digits) : 1;
                setDraft({ ...draft, maxWinners: Math.max(1, next) });
              }}
            />
          </Field>
          <Field label="Days">
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      daysOfWeek: draft.daysOfWeek.includes(i)
                        ? draft.daysOfWeek.filter((x) => x !== i)
                        : [...draft.daysOfWeek, i],
                    })
                  }
                  className={`px-2 py-1 rounded text-xs ${
                    draft.daysOfWeek.includes(i) ? "bg-neon text-black" : "bg-surface text-white/70"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <button className="btn-primary mt-4" onClick={create} disabled={creating}>
          <ButtonLoading loading={creating} loadingText="Creating...">
            Create Window
          </ButtonLoading>
        </button>
      </div>

      <div className="card">
        <h2 className="font-display text-lg">Existing Windows</h2>
        <div className="mt-3 space-y-2">
          {loading ? (
            <>
              <CardSkeleton lines={2} />
              <CardSkeleton lines={2} />
            </>
          ) : items.map((w) => (
            <div key={w.id} className="rounded-md border border-border p-3 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[160px]">
                <div className="text-sm text-white">{w.label}</div>
                <div className="text-xs text-white/50">
                  {w.windowStart} – {w.windowEnd} • Pool {w.prizePool} • {w.daysOfWeek.map((d) => DAYS[d]).join(",")}
                </div>
              </div>
              <button
                className={w.isActive ? "btn-outline" : "btn-primary"}
                onClick={() => patch(w.id, { isActive: !w.isActive })}
                disabled={actingKey?.startsWith(`${w.id}:`)}
              >
                <ButtonLoading loading={actingKey === `${w.id}:patch`} loadingText="Saving...">
                  {w.isActive ? "Disable" : "Enable"}
                </ButtonLoading>
              </button>
              <button
                className="btn-outline text-red-400"
                onClick={() => remove(w.id)}
                disabled={actingKey?.startsWith(`${w.id}:`)}
              >
                <ButtonLoading loading={actingKey === `${w.id}:delete`} loadingText="Deleting...">
                  Delete
                </ButtonLoading>
              </button>
            </div>
          ))}
          {!loading && !items.length && <p className="text-sm text-white/50">No windows yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
