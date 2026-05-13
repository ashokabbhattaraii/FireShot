"use client";
import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "@/lib/api";
import { npr } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { EmptyState, PageHeader, TableLoading } from "@/components/ui";

const ROW_HEIGHT = 60;
const VIRTUALIZE_THRESHOLD = 50;

export default function Leaderboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/leaderboard")
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Prize standings"
        title="Leaderboard"
        description="Rankings are calculated from verified tournament winnings."
        action={<Trophy className="text-neon" />}
      />
      {loading ? (
        <TableLoading columns={3} rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No winners yet"
          description="Verified results will appear here after tournaments complete."
        />
      ) : rows.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualLeaderboard rows={rows} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Total Won</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="py-2 font-semibold">#{i + 1}</td>
                  <td>{r.ign}</td>
                  <td className="text-neon">{npr(r.prizeEarned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VirtualLeaderboard({ rows }: { rows: any[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="table-wrap">
      <div className="grid grid-cols-[80px_1fr_120px] border-b border-border bg-bg/60 px-3 py-2 text-xs font-semibold text-white/60">
        <span>Rank</span>
        <span>Player</span>
        <span className="text-right">Total Won</span>
      </div>
      <div
        ref={parentRef}
        style={{ height: 600, overflow: "auto" }}
        className="bg-card"
      >
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((vRow) => {
            const r = rows[vRow.index];
            return (
              <div
                key={r.userId}
                className="grid grid-cols-[80px_1fr_120px] items-center border-t border-border px-3"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  transform: `translateY(${vRow.start}px)`,
                }}
              >
                <span className="font-semibold">#{vRow.index + 1}</span>
                <span>{r.ign}</span>
                <span className="text-right text-neon">{npr(r.prizeEarned)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
