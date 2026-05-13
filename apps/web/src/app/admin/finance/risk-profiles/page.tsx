"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui";

const filters = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL", "BLACKLISTED"] as const;

export default function RiskProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeFilter !== "ALL") {
      if (activeFilter === "BLACKLISTED") params.set("blacklisted", "true");
      else params.set("riskLevel", activeFilter);
    }
    if (search.trim()) params.set("search", search.trim());
    api<any[]>(`/admin/finance/risk-profiles${params.toString() ? `?${params.toString()}` : ""}`).then(setProfiles).catch(() => {});
  }, [activeFilter, search]);

  const selectedProfile = useMemo(() => selected?.financialRiskProfile ?? null, [selected]);

  async function openProfile(user: any) {
    const detail = await api(`/admin/finance/risk-profiles/${user.id}`);
    setSelected({ ...user, ...detail });
  }

  async function blacklist() {
    if (!selected) return;
    await api(`/admin/finance/blacklist/${selected.id}`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || note.trim() || "Admin review" }),
    });
    setSelected(null);
    setReason("");
    setNote("");
    const params = new URLSearchParams();
    if (activeFilter !== "ALL") {
      if (activeFilter === "BLACKLISTED") params.set("blacklisted", "true");
      else params.set("riskLevel", activeFilter);
    }
    if (search.trim()) params.set("search", search.trim());
    setProfiles(await api<any[]>(`/admin/finance/risk-profiles${params.toString() ? `?${params.toString()}` : ""}`));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance safety"
        title="Risk Profiles"
        description="Admin-only risk monitoring for deposit and withdrawal review."
      />

      <div className="card mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button key={item} className={item === activeFilter ? "btn-primary" : "btn-outline"} onClick={() => setActiveFilter(item)}>
              {item}
            </button>
          ))}
        </div>
        <input className="input max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email" />
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="No matching risk profiles" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Flags</th>
                <th>Total Deposited</th>
                <th>Total Withdrawn</th>
                <th>Account Age</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((user) => {
                const profile = user.financialRiskProfile;
                return (
                  <tr key={user.id} style={{ cursor: "pointer" }} onClick={() => openProfile(user)}>
                    <td>{user.email}</td>
                    <td>
                      <div style={{ width: 120, background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8 }}>
                        <div style={{ width: `${profile?.riskScore ?? 0}%`, height: 8, borderRadius: 999, background: profile?.riskLevel === "CRITICAL" || profile?.riskLevel === "HIGH" ? "#ef4444" : profile?.riskLevel === "MEDIUM" ? "#f59e0b" : "#22c55e" }} />
                      </div>
                    </td>
                    <td>{profile?.riskLevel ?? "LOW"}</td>
                    <td>{Array.isArray(profile?.flags) ? profile.flags.length : 0}</td>
                    <td>{npr(profile?.totalDeposited ?? 0)}</td>
                    <td>{npr(profile?.totalWithdrawn ?? 0)}</td>
                    <td>{profile?.accountAgeDays ?? 0} days</td>
                    <td>{user.lastLoginAt ? fmtDate(user.lastLoginAt) : "-"}</td>
                    <td>
                      <button className="btn-outline text-xs" onClick={(e) => { e.stopPropagation(); openProfile(user); }}>
                        View Profile
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && selectedProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.65)" }}>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(100vw, 860px)", background: "var(--fs-surface-1)", borderLeft: "1px solid var(--fs-border)", overflowY: "auto", padding: 20 }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{selected.email}</h2>
                <p className="text-sm text-white/60">Admin risk detail panel</p>
              </div>
              <button className="btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="card">
                <p className="label">Risk Level</p>
                <p className="mt-2 text-xl font-bold">{selectedProfile.riskLevel}</p>
                <p className="text-sm text-white/60">Score {selectedProfile.riskScore}/100</p>
              </div>
              <div className="card">
                <p className="label">Blacklist Status</p>
                <p className="mt-2 text-xl font-bold">{selectedProfile.isBlacklisted ? "Blacklisted" : "Active"}</p>
                <p className="text-sm text-white/60">{selectedProfile.blacklistReason ?? "No blacklist reason"}</p>
              </div>
            </div>

            <div className="mt-4 card">
              <h3 className="mb-2 font-semibold">Flags</h3>
              <div className="grid gap-2">
                {(selectedProfile.flags ?? []).length > 0 ? (selectedProfile.flags as string[]).map((flag) => <div key={flag} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{flag}</div>) : <p className="text-sm text-white/60">No risk flags detected</p>}
              </div>
            </div>

            <div className="mt-4 card">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="label">Admin Note</span>
                  <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <label className="grid gap-1">
                  <span className="label">Blacklist Reason</span>
                  <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required before blacklisting" />
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn-primary" onClick={blacklist} disabled={!reason.trim() && !note.trim()}>Blacklist</button>
                <button className="btn-outline" onClick={() => setSelected(null)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}