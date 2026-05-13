"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { ButtonLoading, EmptyState, PageHeader, StatusBadge, TableLoading } from "@/components/ui";
import { WithdrawalReviewPanel } from "@/components/admin/WithdrawalReviewPanel";

export default function AdminWithdrawals() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setItems(await api(`/wallet/withdrawals?status=${filter}`));
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => {
    load().catch(() => {});
  }, [filter]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin queue"
        title="Withdrawal Requests"
        description="Approve, reject, and mark player payout requests as paid."
        action={
          <select
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>
        }
      />
      <div className="table-wrap">
        {loading ? (
          <TableLoading columns={7} rows={6} />
        ) : items.length === 0 ? (
          <EmptyState title="No withdrawals in this queue" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Method</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td>{fmtDate(w.createdAt)}</td>
                  <td>{w.user.profile?.ign ?? w.user.email}</td>
                  <td>{w.method}</td>
                  <td>{w.account}</td>
                  <td>{npr(w.amountNpr)}</td>
                  <td>
                    <div style={{ display: "grid", gap: 6 }}>
                      <StatusBadge status={w.status} />
                      <span style={{ fontSize: 11, color: "var(--fs-text-3)" }}>
                        {w.user.financialRiskProfile?.riskLevel ?? "UNKNOWN"}
                      </span>
                    </div>
                  </td>
                  <td className="space-x-1">
                    {w.status === "PENDING" && (
                      <button onClick={() => setReviewId(w.id)} className="btn-primary text-xs">
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {reviewId && (
        <WithdrawalReviewPanel
          withdrawalId={reviewId}
          onClose={() => setReviewId(null)}
          onDecision={() => load(false)}
        />
      )}
    </div>
  );
}
