"use client";
import { useEffect, useState } from "react";
import { api, FILE_BASE } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { ButtonLoading, CardGridSkeleton, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { WithdrawalReviewPanel } from "@/components/admin/WithdrawalReviewPanel";

export default function AdminPayments() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setItems(await api(`/payments?status=${filter}`));
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
        title="Payment Verification"
        description="Approve verified proofs to unlock room details and confirm player slots."
        action={
          <select
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        }
      />
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((p) => (
          <div key={p.id} className="card">
            <div className="flex justify-between">
              <div>
                <p className="label">
                  {p.tournament?.title ?? "Wallet deposit"}
                </p>
                <p className="font-semibold">
                  {p.user.profile?.ign ?? p.user.email}
                </p>
                <p className="text-sm text-white/60">{fmtDate(p.createdAt)}</p>
              </div>
              <p className="text-neon font-bold">{npr(p.amountNpr)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>
                Method: {p.method} {p.reference && `· Ref: ${p.reference}`}
              </span>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-2 text-xs text-white/60">
              Risk: {p.user.financialRiskProfile?.riskLevel ?? "UNKNOWN"}
            </p>
            {p.proofUrl && (
              <a
                href={`${FILE_BASE}${p.proofUrl}`}
                target="_blank"
                rel="noreferrer"
                className="block mt-2"
              >
                <img
                  src={`${FILE_BASE}${p.proofUrl}`}
                  alt="proof"
                  className="rounded-md max-h-48 border border-border"
                />
              </a>
            )}
            {p.status === "PENDING" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => setReviewId(p.id)} className="btn-primary">Review</button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <EmptyState title="No payments in this queue" />}
      </div>
      )}
      {reviewId && (
        <WithdrawalReviewPanel
          withdrawalId={reviewId}
          kind="payment"
          onClose={() => setReviewId(null)}
          onDecision={() => load(false)}
        />
      )}
    </div>
  );
}
