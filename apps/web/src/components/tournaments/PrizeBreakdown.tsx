"use client";
import { Trophy, Skull, Gift } from "lucide-react";
import { npr } from "@/lib/utils";
import {
  TournamentTypeLabels,
  calculateKillPrize,
  calculateSystemFee,
  type TournamentType,
  type PrizeStructure,
} from "@fireslot/shared";

interface Props {
  type: TournamentType;
  entryFee: number;
  prizePool: number;
  prizeStructure?: PrizeStructure | null;
}

export function PrizeBreakdown({ type, entryFee, prizePool, prizeStructure }: Props) {
  const perKill = prizeStructure?.perKillPrize ?? calculateKillPrize(entryFee);
  const sysFee = prizeStructure?.systemFeePerKill ?? calculateSystemFee(entryFee);
  const placements = prizeStructure?.placement ?? [];

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-white flex items-center gap-2">
          <Trophy size={18} className="text-neon" />
          Prize Breakdown
        </h3>
        <span className="rounded-md border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-0.5 text-xs text-neon-cyan">
          {TournamentTypeLabels[type]}
        </span>
      </div>

      {type === "FREE_DAILY" && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-neon-green/40 bg-neon-green/10 px-3 py-2 text-sm text-neon-green">
          <Gift size={14} /> FREE • 1 entry per 24hrs
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Box label="Prize Pool" value={npr(prizePool)} accent />
        <Box label="Entry Fee" value={type === "FREE_DAILY" ? "FREE" : npr(entryFee)} />
        {type !== "FREE_DAILY" && (
          <>
            <Box
              label="Per Kill"
              value={npr(perKill)}
              icon={<Skull size={12} />}
            />
            <Box label="Platform Fee / Kill" value={npr(sysFee)} />
          </>
        )}
      </div>

      {placements.length > 0 && (
        <div className="mt-4">
          <p className="label">Placement Payouts</p>
          <ul className="mt-2 space-y-1 text-sm">
            {placements.map((p) => (
              <li
                key={String(p.rank)}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-white/80">Rank #{p.rank}</span>
                <span className="text-neon font-semibold">
                  {npr(p.amount)}{" "}
                  <span className="text-white/40 text-xs">({p.percent}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {type !== "FREE_DAILY" && entryFee > 0 && (
        <p className="mt-3 text-xs text-white/60">
          Rs {perKill} per kill (after Rs {sysFee} platform fee on each Rs{" "}
          {entryFee} entry).
        </p>
      )}
      {prizeStructure?.notes && (
        <p className="mt-2 text-xs text-white/50">{prizeStructure.notes}</p>
      )}
    </div>
  );
}

function Box({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: any;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${accent ? "border-neon text-neon" : "border-border"}`}
    >
      <div className="label flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-white">{value ?? "—"}</div>
    </div>
  );
}
