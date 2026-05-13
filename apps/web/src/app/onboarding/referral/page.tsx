"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Gift, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";
import { ButtonLoading, PageLoading } from "@/components/ui";

export default function ReferralOnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh } = useAuth();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const next = params.get("next") || "/dashboard";
    return next.startsWith("/") ? next : "/dashboard";
  }, [params]);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setMessage("Referral code must be exactly 6 letters or digits.");
      return;
    }

    setMessage(null);
    setSubmitting(true);
    try {
      await api("/referrals/claim", {
        method: "PUT",
        body: JSON.stringify({ code: normalized }),
      });
      await refresh();
      router.replace(nextPath);
    } catch (e: any) {
      setMessage(e.message ?? "Could not apply referral code");
    } finally {
      setSubmitting(false);
    }
  }

  async function skip() {
    setSkipping(true);
    await refresh();
    router.replace(nextPath);
  }

  if (loading) return <PageLoading label="Loading account..." />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <GoogleAuthPanel title="Sign in to continue" next={nextPath} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-8 pt-4">
      <section className="rounded-xl border border-[rgba(255,193,7,0.28)] bg-[linear-gradient(135deg,rgba(255,193,7,0.16),rgba(229,57,53,0.10),rgba(255,255,255,0.03))] p-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fs-gold)]">Welcome bonus</p>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-bold text-[var(--fs-text-1)]">
          <Gift size={18} />
          Refer & Earn
        </h1>
        <p className="mt-2 text-sm text-[var(--fs-text-2)]">
          If you have a friend code, enter it now to get Rs 10. You can also skip and continue.
        </p>
      </section>

      <form onSubmit={submitCode} className="card space-y-3">
        <div>
          <label className="label">Referral code (6 letters/digits)</label>
          <input
            className="input mt-2 font-mono uppercase tracking-[0.2em]"
            maxLength={6}
            autoComplete="off"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </div>

        <button className="btn-primary w-full" disabled={submitting || skipping}>
          <ButtonLoading loading={submitting} loadingText="Applying code...">
            Submit code
          </ButtonLoading>
        </button>

        <button
          type="button"
          className="btn-outline w-full"
          onClick={skip}
          disabled={submitting || skipping}
        >
          <ButtonLoading loading={skipping} loadingText="Continuing...">
            Skip for now
          </ButtonLoading>
        </button>

        <p className="flex items-start gap-2 text-xs text-amber-200/90">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>No multiple accounts. Self-referrals and fake accounts may be reversed and can lead to bans.</span>
        </p>

        {message && <p className="text-sm text-red-400">{message}</p>}
      </form>
    </div>
  );
}
