"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Gift, ShieldAlert, Sparkles, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";
import { CardSkeleton, LoadingState } from "@/components/ui";

export default function ReferPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api("/referrals/me")
      .then(setData)
      .finally(() => setLoading(false));
  }, [user]);

  function copyCode() {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (authLoading) return <LoadingState label="Loading referral program..." />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <ReferralHero signedOut />
        <GoogleAuthPanel title="Sign in to use Refer & Earn" next="/refer" />
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="space-y-3">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <ReferralHero
        signupReward={data.signupRewardNpr}
        depositReward={data.referrerDepositRewardNpr}
      />

      <div className="card overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label">Your 6-character code</p>
            <p className="mt-2 font-mono text-4xl font-black tracking-[0.18em] text-white">
              {data.code}
            </p>
            <p className="mt-2 text-sm text-white/60">
              No referral link. Ask friends to paste this code during first signup.
            </p>
          </div>
          <button onClick={copyCode} className="btn-primary shrink-0">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Invited" value={data.stats.invited} />
        <MiniStat label="Deposits" value={data.stats.firstDeposits} />
        <MiniStat label="Earned" value={`Rs ${data.stats.earnedNpr}`} />
      </div>

      <div className="card">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Sparkles size={18} className="text-neon" /> How rewards unlock
        </h2>
        <div className="mt-3 space-y-2 text-sm text-white/70">
          <Step text={`Friend signs up with your code and gets Rs ${data.signupRewardNpr}.`} />
          <Step text={`You get Rs ${data.referrerDepositRewardNpr} after their first wallet deposit is approved.`} />
          <Step text="Rewards go straight to wallet balance and are visible in wallet history." />
        </div>
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
        <p className="flex items-start gap-2 text-xs text-amber-200">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>{data.warning}</span>
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Referral activity</h2>
          <Link href="/wallet" className="text-xs text-neon-cyan">Wallet</Link>
        </div>
        <div className="mt-3 space-y-2">
          {data.referrals.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{r.player?.name ?? r.player?.email ?? "Player"}</p>
                <p className="text-xs text-white/50">
                  {r.firstDepositRewarded ? "First deposit reward paid" : "Waiting for first deposit"}
                </p>
              </div>
              <span className={`fs-badge ${r.firstDepositRewarded ? "fs-badge-green" : "fs-badge-amber"}`}>
                {r.firstDepositRewarded ? `Rs ${r.rewardNpr}` : "Pending"}
              </span>
            </div>
          ))}
          {data.referrals.length === 0 && (
            <p className="py-6 text-center text-sm text-white/45">
              Share your code with friends. Your referral activity will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferralHero({
  signedOut,
  signupReward = 10,
  depositReward = 10,
}: {
  signedOut?: boolean;
  signupReward?: number;
  depositReward?: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(135deg,rgba(229,57,53,0.24),rgba(255,193,7,0.16),rgba(11,11,20,0.96))] p-5">
      <div className="relative z-10">
        <span className="fs-badge fs-badge-gold inline-flex items-center gap-1">
          <Gift size={12} /> Refer & Earn
        </span>
        <h1 className="mt-3 font-display text-3xl text-white">
          Turn your squad into wallet rewards.
        </h1>
        <p className="mt-2 text-sm text-white/70">
          New players paste a 6-character code during first signup and get Rs {signupReward}. You earn Rs {depositReward} after their first deposit.
        </p>
        {signedOut && (
          <p className="mt-3 text-xs text-white/55">
            No link needed. Sign in to reveal your own code.
          </p>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="label">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Step({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2">
      <Users size={14} className="mt-0.5 shrink-0 text-neon-cyan" />
      <span>{text}</span>
    </p>
  );
}
