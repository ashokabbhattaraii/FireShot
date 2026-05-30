"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Bell, ShieldCheck, Trophy, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAdminNav } from "@/lib/useAdminNav";
import { fmtDate, npr } from "@/lib/utils";
import { PageLoading, StatusBadge } from "@/components/ui";

export default function AdminOverview() {
  const { user } = useAuth();
  const { nav } = useAdminNav();
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api("/admin/stats")
      .then(setStats)
      .catch((e: any) => setErr(e.message ?? "Could not load admin stats"));
  }, []);

  if (err) return <p className="text-red-500 font-semibold p-4">{err}</p>;
  if (!stats) return <PageLoading label="Loading admin overview..." />;

  const roleName = String(user?.roleRef?.name ?? user?.role ?? "ADMIN").toUpperCase();
  const workspaceTitle =
    roleName === "SUPPORT"
      ? "Support & Dispute Desk"
      : roleName === "FINANCE"
        ? "Finance Operations"
        : "Operations Overview";

  const queue = [
    { label: "Payments", value: stats.pendingPayments, href: "/admin/payments" },
    { label: "Withdrawals", value: stats.pendingWithdrawals, href: "/admin/withdrawals" },
    { label: "Results", value: stats.pendingResults, href: "/admin/results" },
  ];

  const sectionMap: Record<string, { title: string; hint: string; href: string }> = {
    support: { title: "Support & Disputes", hint: "Handle tickets, disputes, and escalations", href: "/admin/support" },
    payments: { title: "Payment Queue", hint: "Review pending deposits and proofs", href: "/admin/payments" },
    withdrawals: { title: "Withdrawal Queue", hint: "Approve or reject withdrawal requests", href: "/admin/withdrawals" },
    results: { title: "Result Verification", hint: "Review submitted match outcomes", href: "/admin/results" },
    referrals: { title: "Referral Program", hint: "Manage rewards and referral settings", href: "/admin/referrals" },
    users: { title: "User Control", hint: "Manage bans, roles, and account actions", href: "/admin/users" },
  };

  const workspaceTiles = (nav ?? ["support", "payments", "withdrawals", "results", "referrals", "users"])
    .filter((key) => key in sectionMap)
    .map((key) => sectionMap[key])
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Zone */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.05]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#E53935] mb-1">
            Admin Command Center
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            {workspaceTitle}
          </h1>
        </div>
        {roleName === "SUPPORT" ? (
          <Link href="/admin/support" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#E53935] hover:bg-[#B71C1C] text-white px-4 py-2 text-xs font-bold transition-all shadow-[0_0_15px_rgba(229,57,53,0.2)]">
            Open Support Queue
          </Link>
        ) : (
          <Link href="/admin/tournaments" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#E53935] hover:bg-[#B71C1C] text-white px-4 py-2 text-xs font-bold transition-all shadow-[0_0_15px_rgba(229,57,53,0.2)]">
            + Create Tournament
          </Link>
        )}
      </div>

      {/* Quick Navigation Workspace Tiles */}
      {workspaceTiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {workspaceTiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group block p-4 rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.01] to-transparent hover:from-white/[0.04] hover:to-transparent hover:border-[#E53935]/20 hover:shadow-[0_0_15px_rgba(229,57,53,0.05)] transition-all duration-300 transform hover:-translate-y-0.5"
            >
              <p className="text-sm font-bold text-white group-hover:text-[#E53935] transition-colors">
                {tile.title}
              </p>
              <p className="mt-1 text-xs text-white/50 leading-normal">
                {tile.hint}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <StatCard
          icon={<Users size={18} />}
          label="Users"
          value={stats.users}
          detail={`${stats.admins} admins · ${stats.bannedUsers} banned`}
        />
        <StatCard
          icon={<Trophy size={18} />}
          label="Tournaments"
          value={stats.tournaments}
          detail={`${stats.liveTournaments} live · ${stats.upcomingTournaments} upcoming`}
        />
        <StatCard
          icon={<Bell size={18} />}
          label="Queue"
          value={queue.reduce((sum, item) => sum + item.value, 0)}
          detail="Pending review cases"
          accent={queue.reduce((sum, item) => sum + item.value, 0) > 0}
        />
        <StatCard
          icon={<Banknote size={18} />}
          label="Revenue"
          value={npr(stats.approvedRevenueNpr)}
          detail="Approved payments"
        />
        <StatCard
          icon={<ShieldCheck size={18} />}
          label="Wallets"
          value={npr(stats.walletLiabilityNpr)}
          detail="Player total balance"
        />
      </div>

      {/* Review Queue & Recent Payments split */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.8fr] gap-6">
        {/* Review Queue Card */}
        <div className="card">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            🔔 Review Queue
          </h2>
          <div className="flex flex-col gap-2.5">
            {queue.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-[#E53935]/20 hover:shadow-[0_0_12px_rgba(229,57,53,0.05)] transition-all text-white text-xs font-semibold"
              >
                <span>{item.label}</span>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  item.value > 0
                    ? "bg-[#ff7a00]/10 text-[#ff7a00]"
                    : "bg-[#39ff14]/10 text-[#39ff14]"
                }`}>
                  {item.value > 0 ? `${item.value} Pending` : "Clear"}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Payments Table Card */}
        <div className="card">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            💳 Recent Payments
          </h2>
          {stats.recentPayments.length === 0 ? (
            <p className="text-xs text-white/40 py-6 text-center">No payments recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentPayments.slice(0, 5).map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-semibold text-white/90">{p.user.profile?.ign ?? p.user.email}</td>
                      <td className="font-extrabold text-yellow-400">{npr(p.amountNpr)}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="text-xs text-white/50">{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Newest Players Card */}
      <div className="card">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          👥 Newest Players
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>IGN</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map((u: any) => (
                <tr key={u.id}>
                  <td className="font-mono text-xs text-white/80 max-w-[180px] truncate">{u.email}</td>
                  <td className="font-semibold text-white/90">{u.profile?.ign ?? "—"}</td>
                  <td>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/55">
                      {u.role}
                    </span>
                  </td>
                  <td className="text-xs text-white/50">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail, accent }: any) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4.5 transition-all duration-300 ${
        accent
          ? "border-[#ff2d75]/30 bg-gradient-to-br from-[#ff2d75]/10 to-transparent shadow-[0_0_15px_rgba(255,45,117,0.08)]"
          : "border-white/5 bg-gradient-to-br from-white/[0.01] to-transparent hover:border-white/10"
      }`}
    >
      {accent && (
        <span className="absolute right-3.5 top-3.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff2d75] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff2d75]"></span>
        </span>
      )}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
        accent
          ? "bg-[#ff2d75]/15 text-[#ff2d75]"
          : "bg-white/5 text-white/70"
      }`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-white tracking-wide">{value}</p>
      <p className="mt-1.5 text-[10px] text-white/45 truncate leading-none">{detail}</p>
    </div>
  );
}
