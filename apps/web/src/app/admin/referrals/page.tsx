"use client";

import { useEffect, useState } from "react";
import { Gift, Save, Users } from "lucide-react";
import { api } from "@/lib/api";
import { ButtonLoading, CardSkeleton, TableLoading } from "@/components/ui";

export default function AdminReferralsPage() {
  const [data, setData] = useState<any>(null);
  const [draft, setDraft] = useState({
    enabled: true,
    signupRewardNpr: "10",
    referrerDepositRewardNpr: "10",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const next = await api<any>("/admin/referrals");
      setData(next);
      setDraft({
        enabled: !!next.enabled,
        signupRewardNpr: String(next.signupRewardNpr ?? 10),
        referrerDepositRewardNpr: String(next.referrerDepositRewardNpr ?? 10),
      });
      setMsg(null);
    } catch (e: any) {
      setErr(e.message ?? "Could not load referral settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function save() {
    setErr(null);
    setMsg(null);
    const signupReward = parseRewardInput(draft.signupRewardNpr);
    const depositReward = parseRewardInput(draft.referrerDepositRewardNpr);

    if (signupReward === null) {
      setErr("New user bonus must be a non-negative number");
      return;
    }
    if (depositReward === null) {
      setErr("Referrer first deposit reward must be a non-negative number");
      return;
    }

    setSaving(true);
    try {
      const next = await api<any>("/admin/referrals/settings", {
        method: "PUT",
        body: JSON.stringify({
          enabled: !!draft.enabled,
          signupRewardNpr: signupReward,
          referrerDepositRewardNpr: depositReward,
        }),
      });
      setData(next);
      setDraft({
        enabled: !!next.enabled,
        signupRewardNpr: String(next.signupRewardNpr ?? 10),
        referrerDepositRewardNpr: String(next.referrerDepositRewardNpr ?? 10),
      });
      setMsg("Referral settings updated successfully.");
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Could not save referral settings");
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    !!data &&
    (draft.enabled !== !!data.enabled ||
      parseRewardInput(draft.signupRewardNpr) !== Number(data.signupRewardNpr ?? 10) ||
      parseRewardInput(draft.referrerDepositRewardNpr) !==
        Number(data.referrerDepositRewardNpr ?? 10));

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Growth</p>
        <h1 className="font-display text-2xl">Refer & Earn</h1>
        <p className="mt-1 text-sm text-white/60">
          Manage referral rewards, first-deposit unlocks, and abuse messaging.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Total Referrals" value={data?.total ?? 0} icon={<Users size={18} />} />
          <Stat label="Signup Bonuses" value={data?.signupRewarded ?? 0} icon={<Gift size={18} />} />
          <Stat label="First Deposits" value={data?.firstDepositRewarded ?? 0} icon={<Gift size={18} />} />
        </div>
      )}

      <div className="card">
        <h2 className="font-display text-lg">Reward Settings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="rounded-lg border border-border bg-surface/40 p-3">
            <span className="label">Program</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-white/80">Enabled</span>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
            </div>
          </label>
          <label>
            <span className="label">New User Bonus</span>
            <input
              className="input mt-1"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="10"
              value={draft.signupRewardNpr}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  signupRewardNpr: sanitizeRewardInput(e.target.value),
                }))
              }
              onBlur={(e) => {
                const parsed = parseRewardInput(e.target.value);
                setDraft((d) => ({
                  ...d,
                  signupRewardNpr: String(parsed ?? 0),
                }));
              }}
            />
          </label>
          <label>
            <span className="label">Referrer First Deposit Reward</span>
            <input
              className="input mt-1"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="10"
              value={draft.referrerDepositRewardNpr}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  referrerDepositRewardNpr: sanitizeRewardInput(e.target.value),
                }))
              }
              onBlur={(e) => {
                const parsed = parseRewardInput(e.target.value);
                setDraft((d) => ({
                  ...d,
                  referrerDepositRewardNpr: String(parsed ?? 0),
                }));
              }}
            />
          </label>
        </div>
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          No multiple accounts: self-referrals, fake accounts, and suspicious deposits can be reversed and banned.
        </p>
        {msg && <p className="mt-3 text-sm text-neon-green">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        <button className="btn-primary mt-4" onClick={save} disabled={saving || !isDirty}>
          <ButtonLoading loading={saving} loadingText="Saving...">
            <Save size={14} /> Save Settings
          </ButtonLoading>
        </button>
        {!isDirty && !saving && (
          <p className="mt-2 text-xs text-white/45">No unsaved changes.</p>
        )}
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableLoading columns={7} rows={8} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Referrer</th><th>Referred</th><th>Code</th><th>Signup</th>
                <th>First Deposit</th><th>Reward</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td>{nameOf(r.referrer)}</td>
                  <td>{nameOf(r.referred)}</td>
                  <td className="font-mono text-xs">{r.codeUsed}</td>
                  <td>{r.signupRewardedAt ? "Paid" : "—"}</td>
                  <td>{r.depositRewardedAt ? "Paid" : "Pending"}</td>
                  <td>Rs {r.referrerDepositRewardNpr ?? 0}</td>
                  <td className="text-xs text-white/60">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(data?.recent ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-white/40">No referrals yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function sanitizeRewardInput(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 6);
}

function parseRewardInput(value: string): number | null {
  const normalized = sanitizeRewardInput(value);
  if (!normalized) return 0;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function Stat({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        <span className="text-neon">{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl text-white">{value}</p>
    </div>
  );
}

function nameOf(user: any) {
  return user?.profile?.ign ?? user?.name ?? user?.email ?? "—";
}
