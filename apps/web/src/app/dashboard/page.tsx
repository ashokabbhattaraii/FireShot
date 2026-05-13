"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Trophy,
  UserCircle,
  Wallet,
} from "lucide-react";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { PageLoading } from "@/components/ui";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [matches, setMatches] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDashboardLoading(true);
    Promise.all([
      api("/wallet")
        .then(setWallet)
        .catch(() => null),
      api("/me/matches")
        .then(setMatches)
        .catch(() => null),
      api("/notifications")
        .then(setNotifications)
        .catch(() => []),
      api("/payments/me")
        .then(setPayments)
        .catch(() => []),
    ]).finally(() => setDashboardLoading(false));
  }, [user]);

  const joined = useMemo(() => matches?.tournaments ?? [], [matches]);
  const nextMatch = useMemo(
    () =>
      joined
        .map((p: any) => p.tournament)
        .filter((t: any) => t && new Date(t.dateTime).getTime() >= Date.now())
        .sort(
          (a: any, b: any) =>
            new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
        )[0],
    [joined],
  );

  if (loading) return <PageLoading label="Loading dashboard..." />;
  if (!user) {
    return (
      <div className="pt-6">
        <GoogleAuthPanel title="Sign in to open your profile" />
      </div>
    );
  }

  if (dashboardLoading && !wallet) return <PageLoading label="Loading dashboard..." />;

  const balance = wallet?.wallet?.balanceNpr ?? user.wallet?.balanceNpr ?? 0;
  const unread = notifications.filter((n) => !n.read).length;
  const pendingPayments = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card/90 p-4">
        <div className="flex items-center gap-3">
          <Avatar src={user.avatarUrl} />
          <div className="min-w-0">
            <p className="label">Profile</p>
            <h1 className="truncate font-display text-2xl text-white">
              {user.profile?.ign ?? user.name ?? user.email}
            </h1>
            <p className="truncate text-sm text-white/55">
              {user.profile
                ? `FF UID ${user.profile.freeFireUid}`
                : "Player profile incomplete"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-surface/70 p-4">
          <p className="label">Available Balance</p>
          <p className="mt-1 font-display text-4xl text-white">
            {npr(balance)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/wallet?tab=deposit" className="btn-primary">
              Deposit
            </Link>
            <Link href="/wallet?tab=withdraw" className="btn-outline">
              Withdraw
            </Link>
          </div>
        </div>
      </section>

      {nextMatch && (
        <Link
          href={`/tournaments/${nextMatch.id}`}
          className="block rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 p-4"
        >
          <p className="label">Next Match</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">
                {nextMatch.title}
              </p>
              <p className="text-sm text-white/60">
                {fmtDate(nextMatch.dateTime)}
              </p>
            </div>
            <ChevronRight className="text-neon-cyan" size={20} />
          </div>
        </Link>
      )}

      <section className="space-y-2">
        <MenuItem
          icon={<UserCircle size={19} />}
          title="Player Profile"
          detail={user.profile ? "Ready for tournaments" : "Complete required"}
          href="/dashboard/profile"
          tone={user.profile ? "text-neon-green" : "text-neon-orange"}
        />
        <MenuItem
          icon={<Trophy size={19} />}
          title="My Matches"
          detail={`${matches?.counts?.tournaments ?? 0} tournament(s), ${matches?.counts?.challenges ?? 0} challenge(s)`}
          href="/my-matches"
        />
        <MenuItem
          icon={<Wallet size={19} />}
          title="Wallet"
          detail={`${wallet?.wallet?.transactions?.length ?? 0} transactions`}
          href="/wallet"
        />
        <MenuItem
          icon={<CreditCard size={19} />}
          title="Payment Queue"
          detail={`${pendingPayments} pending`}
          href="/wallet"
          tone={pendingPayments ? "text-neon-orange" : "text-white/55"}
        />
        <MenuItem
          icon={<Bell size={19} />}
          title="Notifications"
          detail={`${unread} unread`}
          href="/notifications"
          tone={unread ? "text-neon-cyan" : "text-white/55"}
        />
      </section>
    </div>
  );
}

function Avatar({ src }: { src?: string | null }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-neon-cyan">
        <UserCircle size={28} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setBad(true)}
      className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
    />
  );
}

function MenuItem({
  icon,
  title,
  detail,
  href,
  tone = "text-white/55",
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  tone?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card/80 p-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-neon-cyan">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{title}</p>
        <p className={`truncate text-sm ${tone}`}>{detail}</p>
      </div>
      <ChevronRight size={18} className="text-white/35" />
    </Link>
  );
}
