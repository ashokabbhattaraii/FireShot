"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, FILE_BASE } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";

type ReviewKind = "withdrawal" | "payment";

type Props = {
  withdrawalId: string;
  kind?: ReviewKind;
  onClose: () => void;
  onDecision: () => void;
};

const levelStyles: Record<string, { bg: string; fg: string; pulse?: boolean }> = {
  LOW: { bg: "rgba(34,197,94,0.16)", fg: "#4ade80" },
  MEDIUM: { bg: "rgba(245,158,11,0.18)", fg: "#f59e0b" },
  HIGH: { bg: "rgba(239,68,68,0.18)", fg: "#f87171" },
  CRITICAL: { bg: "rgba(239,68,68,0.26)", fg: "#ff6b6b", pulse: true },
};

function RiskRing({ score, level }: { score: number; level: string }) {
  const radius = 34;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const strokeDashoffset = circumference - progress * circumference;
  const style = levelStyles[level] ?? levelStyles.LOW;

  return (
    <div style={{ display: "grid", placeItems: "center", width: 88, height: 88, position: "relative" }}>
      <svg height={88} width={88} style={style.pulse ? { filter: "drop-shadow(0 0 10px rgba(239,68,68,0.35))" } : undefined}>
        <circle
          stroke="rgba(255,255,255,0.1)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={44}
          cy={44}
        />
        <circle
          stroke={style.fg}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          r={normalizedRadius}
          cx={44}
          cy={44}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{score}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: 0.8 }}>{level}</div>
      </div>
    </div>
  );
}

export function WithdrawalReviewPanel({ withdrawalId, kind = "withdrawal", onClose, onDecision }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<"approve" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [hasReviewedRisk, setHasReviewedRisk] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const riskAnchorRef = useRef<HTMLDivElement | null>(null);

  const routeBase = useMemo(() => (kind === "payment" ? "/admin/payments" : "/admin/withdrawals"), [kind]);
  const item = kind === "payment" ? data?.payment : data?.withdrawal;
  const profile = data?.profile ?? item?.user?.financialRiskProfile ?? null;
  const risk = data?.check ?? null;
  const blockedReason = risk?.blockedReason;
  const riskLevel = profile?.riskLevel ?? "LOW";
  const score = profile?.riskScore ?? 0;
  const approveDisabled = !reviewNote.trim() || reviewNote.trim().length < 10 || !hasReviewedRisk || Boolean(blockedReason) || actioning !== null || riskLevel === "CRITICAL";
  const rejectDisabled = !rejectReason.trim() || rejectReason.trim().length < 10 || !hasReviewedRisk || Boolean(blockedReason) || actioning !== null;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const result = await api<any>(`${routeBase}/${withdrawalId}/risk`);
        if (mounted) setData(result);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load().catch(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, [routeBase, withdrawalId]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = riskAnchorRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setHasReviewedRisk(true);
        }
      },
      { root, threshold: 0.55 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [data]);

  async function submitDecision(decision: "approve" | "reject", force = false) {
    const body =
      decision === "approve"
        ? { reviewNote }
        : { reason: rejectReason.trim() || reviewNote.trim() };
    if (force) (body as any).force = true;
    if (decision === "approve") {
      const label = kind === "payment" ? "Deposit" : "Withdrawal";
      const ok = window.confirm(
        `Confirm ${label} Approval\n\nUser: ${item?.user?.name ?? item?.user?.email ?? "Unknown"} | Amount: ${npr(item?.amountNpr ?? 0)} | Risk: ${riskLevel}\n\nThis action is irreversible and logged with your identity.`,
      );
      if (!ok) return;
    }
    setActioning(decision);
    try {
      await api(`${routeBase}/${withdrawalId}/${decision === "approve" ? "approve" : "reject"}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onDecision();
      onClose();
    } finally {
      setActioning(null);
    }
  }

  const historyTx = data?.transactions ?? [];
  const tournaments = data?.participants ?? [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.7)" }}>
      <div
        ref={scrollRef}
        style={{
          position: "absolute",
          inset: 0,
          marginLeft: "auto",
          width: "min(100vw, 980px)",
          background: "var(--fs-surface-1)",
          borderLeft: "1px solid var(--fs-border)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: 20, borderBottom: "1px solid var(--fs-border)", position: "sticky", top: 0, background: "var(--fs-surface-1)", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--fs-text-3)" }}>
                {kind === "payment" ? "Deposit review" : "Withdrawal review"}
              </p>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                {item?.user?.name ?? item?.user?.email ?? "Review"}
              </h2>
              <p style={{ color: "var(--fs-text-3)", marginTop: 4 }}>{kind === "payment" ? "Deposit proof and risk profile" : "Mandatory risk profile before approval"}</p>
            </div>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>Loading...</div>
        ) : !data ? (
          <div style={{ padding: 24 }}>Unable to load review data.</div>
        ) : (
          <div style={{ padding: 20, display: "grid", gap: 16 }}>
            {blockedReason && (
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(239,68,68,0.12)", color: "#ffb4b4", border: "1px solid rgba(239,68,68,0.28)" }}>
                {blockedReason}
              </div>
            )}

            <section style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
                <div>
                  <p style={{ color: "var(--fs-text-3)", fontSize: 12 }}>Amount</p>
                  <p style={{ fontSize: 18, fontWeight: 800 }}>{npr(item?.amountNpr ?? 0)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--fs-text-3)", fontSize: 12 }}>Requested</p>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{fmtDate(item?.createdAt ?? new Date())}</p>
                </div>
                <div>
                  <p style={{ color: "var(--fs-text-3)", fontSize: 12 }}>Method</p>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{item?.method ?? "-"}</p>
                </div>
                <div>
                  <p style={{ color: "var(--fs-text-3)", fontSize: 12 }}>Account</p>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{item?.account ?? item?.reference ?? "-"}</p>
                </div>
              </div>
              {kind === "payment" && item?.proofUrl && (
                <a href={`${FILE_BASE}${item.proofUrl}`} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 14 }}>
                  <img src={`${FILE_BASE}${item.proofUrl}`} alt="proof" style={{ width: "100%", borderRadius: 14, border: "1px solid var(--fs-border)", maxHeight: 360, objectFit: "cover" }} />
                </a>
              )}
            </section>

            <section ref={riskAnchorRef} style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <RiskRing score={score} level={riskLevel} />
                <div>
                  <div style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12, background: levelStyles[riskLevel]?.bg ?? levelStyles.LOW.bg, color: levelStyles[riskLevel]?.fg ?? levelStyles.LOW.fg }}>
                    {riskLevel}
                  </div>
                  <p style={{ marginTop: 10, color: "var(--fs-text-3)" }}>
                    Mandatory read completed: {hasReviewedRisk ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                <Stat label="Total Deposited" value={npr(profile?.totalDeposited ?? 0)} />
                <Stat label="Total Withdrawn" value={npr(profile?.totalWithdrawn ?? 0)} />
                <Stat label="Prize Earned" value={npr(profile?.totalPrizeEarned ?? 0)} />
                <Stat label="Tournaments" value={String(profile?.tournamentCount ?? 0)} />
                <Stat label="Wins" value={String(profile?.winCount ?? 0)} />
                <Stat label="Account Age" value={`${profile?.accountAgeDays ?? 0} days`} />
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 8, color: "var(--fs-text-3)", fontSize: 13 }}>
                <div>Last login: {profile?.lastLoginAt ? `${Math.max(0, Math.floor((Date.now() - new Date(profile.lastLoginAt).getTime()) / 86_400_000))} days ago` : "-"}</div>
                <div>Last deposit: {profile?.lastDepositAt ? `${Math.max(0, Math.floor((Date.now() - new Date(profile.lastDepositAt).getTime()) / 86_400_000))} days ago` : "-"}</div>
                <div>Last withdraw: {profile?.lastWithdrawAt ? `${Math.max(0, Math.floor((Date.now() - new Date(profile.lastWithdrawAt).getTime()) / 86_400_000))} days ago` : "-"}</div>
              </div>
            </section>

            <section style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}>
              <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Risk Flags</h3>
              {(profile?.flags?.length ?? 0) > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {profile.flags.map((flag: string) => (
                    <div key={flag} style={{ padding: 12, borderRadius: 12, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#ffd58a" }}>
                      {flag}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 12, borderRadius: 12, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#9af7bc" }}>No risk flags detected</div>
              )}
            </section>

            <section style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}>
              <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Transaction History</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historyTx.map((tx: any) => (
                    <tr key={tx.id}>
                      <td>{fmtDate(tx.createdAt)}</td>
                      <td>{tx.reason}</td>
                      <td>{npr(tx.amountNpr)}</td>
                      <td>{tx.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}>
              <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Tournament History</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tournament</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Won?</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{entry.tournament?.title ?? "-"}</td>
                      <td>{fmtDate(entry.joinedAt)}</td>
                      <td>{entry.tournament?.status ?? "-"}</td>
                      <td>{entry.prizeEarned > 0 ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={{ padding: 16, border: "1px solid var(--fs-border)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>Review Note</span>
                <textarea
                  className="input"
                  rows={4}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Write the audit note that will be stored with this decision"
                />
              </label>
              <div style={{ marginTop: 8, color: "var(--fs-text-3)", fontSize: 12 }}>{reviewNote.length} characters</div>

              <label style={{ display: "grid", gap: 8, marginTop: 14 }}>
                <span style={{ fontWeight: 700 }}>Reject Reason</span>
                <textarea
                  className="input"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason shown to the user"
                />
              </label>
            </section>

            <div style={{ position: "sticky", bottom: 0, padding: 16, borderTop: "1px solid var(--fs-border)", background: "linear-gradient(180deg, rgba(9,11,18,0), rgba(9,11,18,0.96) 20%)", display: "flex", gap: 12, justifyContent: "space-between" }}>
              <button className="btn-outline" disabled={rejectDisabled} onClick={() => submitDecision("reject")}>
                {actioning === "reject" ? "Rejecting..." : "Reject"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" disabled={approveDisabled} onClick={() => submitDecision("approve")}>{actioning === "approve" ? "Approving..." : "Approve"}</button>
                {(blockedReason || riskLevel === "CRITICAL") && (
                  <button
                    className="btn-ghost"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#ff6b6b", border: "1px solid rgba(239,68,68,0.16)" }}
                    onClick={() => {
                      const ok = window.confirm(
                        `FORCE Approve\n\nThis user is flagged: ${blockedReason ?? riskLevel}. Only ADMIN/SUPER_ADMIN may force-approve. This will be logged. Continue?`,
                      );
                      if (!ok) return;
                      submitDecision("approve", true);
                    }}
                  >
                    {actioning === "approve" ? "Approving..." : "Approve Anyway"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--fs-border)" }}>
      <p style={{ fontSize: 11, color: "var(--fs-text-3)" }}>{label}</p>
      <p style={{ marginTop: 5, fontWeight: 800 }}>{value}</p>
    </div>
  );
}