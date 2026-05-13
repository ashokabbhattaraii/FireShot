"use client";
import { useEffect, useState } from "react";
import { api, FILE_BASE } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { ButtonLoading, CardGridSkeleton, EmptyState, PageHeader } from "@/components/ui";

export default function AdminResults() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setItems(await api("/results?verified=false"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);
  async function verify(id: string) {
    setVerifyingId(id);
    try {
      await api(`/results/${id}/verify`, { method: "POST" });
      await load(false);
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin queue"
        title="Match Results"
        description="Review submitted screenshots, placements, and kills before marking results verified."
      />
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((r) => (
          <div key={r.id} className="card">
            <p className="label">{r.tournament.title}</p>
            <p className="font-semibold">
              {r.submitter.profile?.ign ?? r.submitter.email}
            </p>
            <p className="text-sm">
              Placement: {r.placement ?? "—"} · Kills: {r.kills ?? "—"}
            </p>
            <p className="text-xs text-white/60">{fmtDate(r.createdAt)}</p>
            {r.screenshotUrl && (
              <img
                src={`${FILE_BASE}${r.screenshotUrl}`}
                alt="result"
                className="mt-2 rounded-md max-h-48 border border-border"
              />
            )}
            <button
              onClick={() => verify(r.id)}
              className="btn-primary mt-3"
              disabled={verifyingId === r.id}
            >
              <ButtonLoading loading={verifyingId === r.id} loadingText="Verifying...">
                Verify
              </ButtonLoading>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <EmptyState
            title="No pending results"
            description="Unverified result submissions will appear here."
          />
        )}
      </div>
      )}
    </div>
  );
}
