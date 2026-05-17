"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, FILE_BASE } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { ButtonLoading, CardGridSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

export default function AdminResults() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { placement: string; kills: string; note: string }>>({});

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const tournamentId = searchParams?.get("tournamentId");
      const query = tournamentId ? `/results?verified=false&tournamentId=${encodeURIComponent(tournamentId)}` : "/results?verified=false";
      const data = await api(query);
      setItems(data);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const item of data) {
          next[item.id] = next[item.id] ?? {
            placement: item.placement?.toString() ?? "",
            kills: item.kills?.toString() ?? "",
            note: item.note ?? "",
          };
        }
        return next;
      });
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

  async function saveResult(id: string) {
    setSavingId(id);
    try {
      const draft = drafts[id];
      await api(`/results/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          placement: draft?.placement ? Number(draft.placement) : null,
          kills: draft?.kills ? Number(draft.kills) : null,
          note: draft?.note || null,
        }),
      });
      await load(false);
    } finally {
      setSavingId(null);
    }
  }

  function modeHint(mode: string) {
    if (mode === "KILL_RACE") return "Enter kills only";
    if (mode === "SOLO_1ST" || mode === "SOLO_TOP3" || mode === "SQUAD_TOP10") return "Update placement and kills";
    return "Update placement and kills";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin queue"
        title="Match Results"
        description="Review submitted screenshots, fix placement or kill counts per game type, then verify the result."
      />
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((r) => (
          <div key={r.id} className="card">
            <p className="label">{r.tournament.title}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={r.tournament.mode} />
              <span className="text-xs text-white/50">{modeHint(r.tournament.mode)}</span>
            </div>
            <p className="font-semibold">
              {r.submitter.profile?.ign ?? r.submitter.email}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-white/60">
                <span>Placement</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={drafts[r.id]?.placement ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], placement: e.target.value } }))}
                  placeholder="1"
                />
              </label>
              <label className="space-y-1 text-xs text-white/60">
                <span>Kills</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={drafts[r.id]?.kills ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], kills: e.target.value } }))}
                  placeholder="0"
                />
              </label>
            </div>
            <label className="mt-2 block space-y-1 text-xs text-white/60">
              <span>Admin note</span>
              <textarea
                className="input min-h-[72px]"
                value={drafts[r.id]?.note ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], note: e.target.value } }))}
                placeholder="Reason for correction or verification note"
              />
            </label>
            <p className="text-xs text-white/60">{fmtDate(r.createdAt)}</p>
            {r.screenshotUrl && (
              <img
                src={`${FILE_BASE}${r.screenshotUrl}`}
                alt="result"
                className="mt-2 rounded-md max-h-48 border border-border"
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => saveResult(r.id)}
                className="btn-outline"
                disabled={savingId === r.id}
              >
                <ButtonLoading loading={savingId === r.id} loadingText="Saving...">
                  Save changes
                </ButtonLoading>
              </button>
              <button
                onClick={() => verify(r.id)}
                className="btn-primary"
                disabled={verifyingId === r.id}
              >
                <ButtonLoading loading={verifyingId === r.id} loadingText="Verifying...">
                  Verify
                </ButtonLoading>
              </button>
            </div>
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
