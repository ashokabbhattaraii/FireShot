"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { EmptyState, PageHeader, TableLoading } from "@/components/ui";

type ReportType = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export default function AdminReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [type, setType] = useState<ReportType>("DAILY");
  const [from, setFrom] = useState(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [loadingState, setLoadingState] = useState(false);

  useEffect(() => {
    if (!loading && user?.role === "FINANCE") {
      router.replace("/admin/payments");
    }
  }, [loading, router, user]);

  useEffect(() => {
    api<any[]>("/admin/reports").then(setSavedReports).catch(() => {});
  }, []);

  const reportRange = useMemo(() => {
    const now = new Date();
    if (type === "DAILY") return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now };
    if (type === "WEEKLY") return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
    if (type === "MONTHLY") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
    return { from: new Date(from), to: new Date(to) };
  }, [from, to, type]);

  async function generate() {
    setLoadingState(true);
    try {
      const next = await api("/admin/reports/generate", {
        method: "POST",
        body: JSON.stringify({ type, from: reportRange.from.toISOString(), to: reportRange.to.toISOString() }),
      });
      setReport(next);
      setSavedReports(await api<any[]>("/admin/reports"));
    } finally {
      setLoadingState(false);
    }
  }

  const dailyBreakdown = report?.dailyBreakdown ?? report?.data?.dailyBreakdown ?? [];
  const summary = report?.summary ?? report?.data?.summary ?? null;
  const risk = report?.risk ?? report?.data?.risk ?? null;
  const topEarners = report?.topEarners ?? report?.data?.topEarners ?? [];
  const topDepositors = report?.topDepositors ?? report?.data?.topDepositors ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Admin reports"
        title="Financial Reports"
        description="Generate admin-only financial summaries and risk overviews."
      />

      <div className="card mb-6 grid gap-4">
        <div className="flex flex-wrap gap-2">
          {(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as ReportType[]).map((item) => (
            <button key={item} className={item === type ? "btn-primary" : "btn-outline"} onClick={() => setType(item)}>
              {item}
            </button>
          ))}
        </div>
        {type === "CUSTOM" && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="label">From</span>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="grid gap-1">
              <span className="label">To</span>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={generate} disabled={loadingState}>
            {loadingState ? "Generating..." : "Generate Report"}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              if (!report) return;
              const csv = buildDetailedCsv(report);
              downloadCsv(`financial-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
            }}
            disabled={!report}
          >
            Export CSV (Detailed)
          </button>
          <span className="text-xs text-white/60">
            Range: {fmtDate(reportRange.from)} - {fmtDate(reportRange.to)}
          </span>
        </div>
      </div>

      {report ? (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Metric title="Total Deposits" value={npr(summary?.totalDeposits?.amount ?? 0)} accent="text-emerald-400" />
            <Metric title="Total Withdrawals" value={npr(summary?.totalWithdrawals?.amount ?? 0)} accent="text-red-400" />
            <Metric title="Prize Payouts" value={npr(summary?.totalPrizesPaid?.amount ?? 0)} accent="text-amber-400" />
            <Metric title="Entry Fees Collected" value={npr(summary?.totalEntryFees?.amount ?? 0)} accent="text-sky-400" />
            <Metric title="Platform Revenue" value={npr(summary?.platformRevenue ?? 0)} accent="text-fuchsia-400" />
            <Metric title="New Users" value={String(summary?.newUsers ?? 0)} accent="text-cyan-400" />
          </div>

          <div className="card grid gap-4 md:grid-cols-3">
            <div>
              <p className="label">Risk Summary</p>
              <p className="mt-2 text-sm">Critical users: {risk?.criticalUsers ?? 0}</p>
              <p className="text-sm">High risk users: {risk?.highRiskUsers ?? 0}</p>
              <Link className="mt-3 inline-block text-sm text-emerald-400" href="/admin/finance/risk-profiles">
                View Risk Profiles
              </Link>
            </div>
            <div className="md:col-span-2">
              <p className="label mb-3">Daily Breakdown</p>
              <div className="space-y-3">
                {dailyBreakdown.map((day: any) => (
                  <div key={day.date} className="grid gap-2 md:grid-cols-[120px_1fr] md:items-center">
                    <div className="text-sm text-white/70">{day.date}</div>
                    <div className="grid gap-1">
                      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (day.deposits / Math.max(1, day.deposits + day.withdrawals + day.prizes)) * 100)}%` }} />
                      </div>
                      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (day.withdrawals / Math.max(1, day.deposits + day.withdrawals + day.prizes)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {dailyBreakdown.length === 0 && <EmptyState title="No activity in this period" />}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 font-semibold">Top 10 Earners</h3>
              <table className="data-table">
                <thead><tr><th>Rank</th><th>User</th><th>Prize Earned</th><th>Tournaments Won</th></tr></thead>
                <tbody>{topEarners.map((row: any, index: number) => (
                  <tr key={row.userId}><td>{index + 1}</td><td>{row.email}</td><td>{npr(row.amount ?? 0)}</td><td>{row.count ?? 0}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="card">
              <h3 className="mb-3 font-semibold">Top 10 Depositors</h3>
              <table className="data-table">
                <thead><tr><th>Rank</th><th>User</th><th>Total Deposited</th><th>Last Deposit</th></tr></thead>
                <tbody>{topDepositors.map((row: any, index: number) => (
                  <tr key={row.userId}><td>{index + 1}</td><td>{row.email}</td><td>{npr(row.amount ?? 0)}</td><td>{row.lastDepositAt ? fmtDate(row.lastDepositAt) : "-"}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Saved Reports</h3>
              {report && (
                <button
                  className="btn-outline text-xs"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `financial-report-${new Date().toISOString().slice(0, 10)}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download JSON
                </button>
              )}
              {report && (
                <button
                  className="btn-ghost text-xs"
                  onClick={() => {
                    const csv = buildDetailedCsv(report);
                    downloadCsv(`financial-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  }}
                >
                  Export CSV
                </button>
              )}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Type</th><th>Period</th><th>Generated At</th><th></th></tr></thead>
                <tbody>
                  {savedReports.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.reportType}</td>
                      <td>{fmtDate(entry.fromDate)} - {fmtDate(entry.toDate)}</td>
                      <td>{fmtDate(entry.createdAt)}</td>
                      <td><button className="btn-outline text-xs" onClick={() => setReport(entry.data ?? entry)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="Generate a report to see metrics" />
      )}
    </div>
  );
}

function Metric({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="card">
      <p className="label">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: any) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildDetailedCsv(report: any) {
  const rows: string[][] = [];

  // Summary block
  rows.push(["Section", "Key", "Value"]);
  const summary = report?.summary ?? report?.data?.summary ?? {};
  for (const [key, val] of Object.entries(summary || {})) {
    if (val && typeof val === "object" && "amount" in (val as any)) {
      rows.push(["Summary", key, String((val as any).amount ?? "")]);
    } else {
      rows.push(["Summary", key, String(val ?? "")]);
    }
  }

  // Daily breakdown with calculated totals & percentages
  rows.push([]);
  rows.push(["Daily Breakdown", "Date", "Deposits", "Withdrawals", "Prizes", "Deposits % of Activity", "Withdrawals % of Activity"]);
  const daily = report?.dailyBreakdown ?? report?.data?.dailyBreakdown ?? [];
  let aggDeposits = 0, aggWithdrawals = 0, aggPrizes = 0;
  for (const d of daily) {
    const dep = Number(d.deposits || 0);
    const wit = Number(d.withdrawals || 0);
    const pri = Number(d.prizes || 0);
    aggDeposits += dep;
    aggWithdrawals += wit;
    aggPrizes += pri;
    const total = dep + wit + pri || 1;
    rows.push(["Daily", d.date, String(dep), String(wit), String(pri), `${((dep / total) * 100).toFixed(2)}%`, `${((wit / total) * 100).toFixed(2)}%`]);
  }
  rows.push(["Daily", "TOTAL", String(aggDeposits), String(aggWithdrawals), String(aggPrizes), "", ""]);

  // Top Earners
  rows.push([]);
  rows.push(["Top Earners", "Rank", "User Email", "Amount", "Tournaments Won"]);
  const earners = report?.topEarners ?? report?.data?.topEarners ?? [];
  for (let i = 0; i < earners.length; i++) {
    const r = earners[i];
    rows.push(["TopEarners", String(i + 1), r.email ?? r.userId ?? "", String(r.amount ?? 0), String(r.count ?? 0)]);
  }

  // Top Depositors
  rows.push([]);
  rows.push(["Top Depositors", "Rank", "User Email", "Total Deposited", "Last Deposit At", "% of Total Deposits"]);
  const depositors = report?.topDepositors ?? report?.data?.topDepositors ?? [];
  const totalDeposits = aggDeposits || depositors.reduce((s: number, r: any) => s + Number(r.amount || 0), 0) || 1;
  for (let i = 0; i < depositors.length; i++) {
    const r = depositors[i];
    const pct = ((Number(r.amount || 0) / totalDeposits) * 100).toFixed(2) + "%";
    rows.push(["TopDepositors", String(i + 1), r.email ?? r.userId ?? "", String(r.amount ?? 0), r.lastDepositAt ?? "", pct]);
  }

  // Risk list
  rows.push([]);
  rows.push(["Risk Summary", "Metric", "Value"]);
  const risk = report?.risk ?? report?.data?.risk ?? {};
  for (const [k, v] of Object.entries(risk || {})) rows.push(["Risk", k, String(v ?? "")]);

  // Flatten rows to CSV
  const csv = rows
    .map((r) => r.map((c) => escapeCsv(c)).join(","))
    .join("\n");
  return csv;
}