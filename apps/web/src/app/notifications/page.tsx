"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { ButtonLoading, EmptyState, PageHeader, StatusBadge, TableLoading } from "@/components/ui";

function getNotificationLink(n: any): string | null {
  const body = (n.body ?? "") + " " + (n.title ?? "");
  if (n.type === "CHALLENGE") {
    const chMatch = body.match(/CH-\d+/);
    if (chMatch) return "/my-matches";
    return "/challenges";
  }
  if (n.type === "TOURNAMENT") return "/tournaments";
  if (n.type === "WALLET" || n.type === "PAYMENT") return "/wallet";
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function load() {
    setItems(await api("/notifications"));
  }
  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    setMarkingId(id);
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      await load();
    } finally {
      setMarkingId(null);
    }
  }

  function handleClick(n: any) {
    const link = getNotificationLink(n);
    if (link) {
      if (!n.read) markRead(n.id);
      router.push(link);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Match updates, wallet alerts, and system messages."
      />
      <div className="mt-4 space-y-2">
        {loading ? (
          <TableLoading columns={2} rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Important match and wallet updates will appear here."
          />
        ) : (
          items.map((n) => {
            const link = getNotificationLink(n);
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`card flex justify-between items-start gap-3 ${n.read ? "opacity-60" : ""} ${link ? "cursor-pointer hover:border-white/20 transition" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <StatusBadge status={n.type} />
                  </div>
                  {n.body && <p className="text-xs text-white/70 mt-1">{n.body}</p>}
                  <p className="text-[10px] text-white/40 mt-1">{fmtDate(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.read && (
                    <button
                      disabled={markingId === n.id}
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="btn-outline text-[10px] px-2 py-1"
                    >
                      <ButtonLoading loading={markingId === n.id} loadingText="...">
                        Read
                      </ButtonLoading>
                    </button>
                  )}
                  {link && <span className="text-white/30 text-xs">→</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
