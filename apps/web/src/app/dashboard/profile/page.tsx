"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Gift, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { profileSchema } from "@fireslot/shared";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";
import { ButtonLoading, PageHeader, PageLoading } from "@/components/ui";

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const [form, setForm] = useState({
    freeFireUid: "",
    ign: "",
    level: 1,
    region: "",
    headshotRate: 0,
    isEmulator: false,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.profile)
      setForm({
        freeFireUid: user.profile.freeFireUid,
        ign: user.profile.ign,
        level: user.profile.level,
        region: user.profile.region ?? "",
        headshotRate: user.profile.headshotRate ?? 0,
        isEmulator: user.profile.isEmulator ?? false,
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api("/referrals/me").then(setReferral).catch(() => setReferral(null));
  }, [user]);

  function copyCode() {
    if (!referral?.code) return;
    navigator.clipboard.writeText(referral.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({
      freeFireUid: form.freeFireUid,
      ign: form.ign,
      level: Number(form.level),
      region: form.region || undefined,
    });
    if (!parsed.success) {
      setMsg(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    setSaving(true);
    try {
      await api("/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...parsed.data,
          headshotRate: Number(form.headshotRate) || null,
          isEmulator: !!form.isEmulator,
        }),
      });
      await refresh();
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading label="Loading profile..." />;
  if (!user)
    return (
      <div className="mx-auto max-w-md">
        <GoogleAuthPanel title="Sign in to edit your profile" />
      </div>
    );

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        eyebrow="Player identity"
        title="Player Profile"
        description="Keep your Free Fire UID, IGN, level, and region accurate for tournament verification."
      />

      {referral && (
        <section className="mt-4 rounded-xl border border-[rgba(255,193,7,0.28)] bg-[linear-gradient(135deg,rgba(255,193,7,0.16),rgba(229,57,53,0.1),rgba(255,255,255,0.04))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fs-gold)]">Refer & Earn</p>
              <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-[var(--fs-text-1)]">
                <Gift size={16} />
                Your code: <span className="font-mono tracking-[0.16em]">{referral.code}</span>
              </h2>
              <p className="mt-2 text-xs text-[var(--fs-text-2)]">
                Friend gets Rs {referral.signupRewardNpr}. You get Rs {referral.referrerDepositRewardNpr} after their first approved deposit.
              </p>
            </div>
            <button type="button" onClick={copyCode} className="btn-primary shrink-0 text-xs">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Invited" value={referral.stats?.invited ?? 0} />
            <MiniStat label="Deposits" value={referral.stats?.firstDeposits ?? 0} />
            <MiniStat label="Earned" value={`Rs ${referral.stats?.earnedNpr ?? 0}`} />
          </div>

          <p className="mt-3 flex items-start gap-2 text-[11px] text-amber-200/90">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>{referral.warning ?? "No multiple accounts. Self-referrals and fake accounts may be reversed or banned."}</span>
          </p>

          <Link href="/refer" className="mt-3 inline-flex text-xs font-semibold text-[var(--fs-gold)] underline underline-offset-2">
            Open full Refer & Earn center
          </Link>
        </section>
      )}

      <form onSubmit={submit} className="card mt-4 space-y-3">
        <div>
          <label className="label">Free Fire UID</label>
          <input
            className="input"
            value={form.freeFireUid}
            onChange={(e) => setForm({ ...form, freeFireUid: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">In-Game Name</label>
          <input
            className="input"
            value={form.ign}
            onChange={(e) => setForm({ ...form, ign: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Level</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              value={form.level}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const next = digits ? Number(digits) : 1;
                setForm({ ...form, level: Math.max(1, Math.min(100, next)) });
              }}
            />
          </div>
          <div>
            <label className="label">Region</label>
            <input
              className="input"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">BR Headshot Rate %</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              value={form.headshotRate}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const next = digits ? Number(digits) : 0;
                setForm({
                  ...form,
                  headshotRate: Math.max(0, Math.min(100, next)),
                });
              }}
            />
            <p className="mt-1 text-[10px] text-white/40">
              From your Free Fire career stats. Tournaments with a headshot rate
              limit will check this value.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="label">Emulator / PC Player</span>
            <span className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <input
                type="checkbox"
                checked={form.isEmulator}
                onChange={(e) =>
                  setForm({ ...form, isEmulator: e.target.checked })
                }
              />
              <span className="text-xs text-white/70">
                I play on emulator / PC
              </span>
            </span>
          </label>
        </div>
        <button className="btn-primary w-full" disabled={saving}>
          <ButtonLoading loading={saving} loadingText="Saving profile...">
            Save
          </ButtonLoading>
        </button>
        {msg && <p className="text-sm text-white/70">{msg}</p>}
      </form>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fs-text-3)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--fs-text-1)]">{value}</p>
    </div>
  );
}
