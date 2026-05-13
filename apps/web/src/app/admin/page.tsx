"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Bell, ShieldCheck, Trophy, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAdminNav } from "@/lib/useAdminNav";
import { fmtDate, npr } from "@/lib/utils";
import { PageLoading } from "@/components/ui";

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

  if (err) return <p style={{ color: "var(--fs-red)" }}>{err}</p>;
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "var(--fs-text-3)", textTransform: "uppercase" }}>
            Admin Command Center
          </p>
          <h1 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, color: "var(--fs-text-1)", marginTop: 4 }}>
            {workspaceTitle}
          </h1>
        </div>
        {roleName === "SUPPORT" ? (
          <Link href="/admin/support" className="fs-btn fs-btn-primary fs-btn-sm">
            Open Support Queue
          </Link>
        ) : (
          <Link href="/admin/tournaments" className="fs-btn fs-btn-primary fs-btn-sm">
            + Create Tournament
          </Link>
        )}
      </div>

      {workspaceTiles.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 210px), 1fr))",
            gap: 10,
          }}
        >
          {workspaceTiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              style={{
                textDecoration: "none",
                borderRadius: 12,
                border: "1px solid var(--fs-border)",
                background: "var(--fs-surface-1)",
                padding: 12,
                display: "block",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fs-text-1)" }}>{tile.title}</p>
              <p style={{ marginTop: 4, fontSize: 11, color: "var(--fs-text-3)" }}>{tile.hint}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div
        className="admin-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
          gap: 12,
        }}
      >
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
          detail="Needs review"
          accent
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
          detail="Player balance"
        />
      </div>

      {/* Review Queue + Recent Payments */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 16,
        }}
      >
        <div className="fs-card fs-card-body">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--fs-text-1)" }}>Review Queue</h2>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {queue.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--fs-surface-2)",
                  border: "1px solid var(--fs-border)",
                  textDecoration: "none",
                  color: "var(--fs-text-1)",
                  fontSize: 13,
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.value > 0 ? "var(--fs-amber)" : "var(--fs-green)" }}>
                  {item.value}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="fs-card fs-card-body">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--fs-text-1)" }}>Recent Payments</h2>
          {stats.recentPayments.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--fs-text-3)" }}>No payments yet.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 400 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--fs-border)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>User</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>Amount</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>Status</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentPayments.slice(0, 5).map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--fs-border)" }}>
                      <td style={{ padding: "8px", color: "var(--fs-text-1)" }}>{p.user.profile?.ign ?? p.user.email}</td>
                      <td style={{ padding: "8px", color: "var(--fs-text-1)" }}>{npr(p.amountNpr)}</td>
                      <td style={{ padding: "8px", color: p.status === "APPROVED" ? "var(--fs-green)" : p.status === "REJECTED" ? "var(--fs-red)" : "var(--fs-amber)" }}>
                        {p.status}
                      </td>
                      <td style={{ padding: "8px", color: "var(--fs-text-3)" }}>{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Newest Players */}
      <div className="fs-card fs-card-body">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--fs-text-1)" }}>Newest Players</h2>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 400 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--fs-border)" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>Email</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>IGN</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>Role</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--fs-text-3)", fontWeight: 600 }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map((u: any) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--fs-border)" }}>
                  <td style={{ padding: "8px", color: "var(--fs-text-1)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</td>
                  <td style={{ padding: "8px", color: "var(--fs-text-1)" }}>{u.profile?.ign ?? "-"}</td>
                  <td style={{ padding: "8px", color: "var(--fs-text-2)" }}>{u.role}</td>
                  <td style={{ padding: "8px", color: "var(--fs-text-3)" }}>{fmtDate(u.createdAt)}</td>
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
      className="stat-card"
      style={{
        padding: 14,
        borderRadius: 12,
        background: "var(--fs-surface-1)",
        border: accent ? "1px solid var(--fs-red)" : "1px solid var(--fs-border)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--fs-surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fs-red)",
          marginBottom: 10,
        }}
      >
        {icon}
      </div>
      <p className="stat-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "var(--fs-text-3)", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color: "var(--fs-text-1)", marginTop: 2 }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>{detail}</p>
    </div>
  );
}
