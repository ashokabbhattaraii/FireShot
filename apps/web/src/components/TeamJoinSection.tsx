"use client";

import { useState } from "react";
import { Users } from "lucide-react";

interface Teammate {
  freefireUid: string;
  igName: string;
}

function getTeamSizeFromMode(mode: string): number {
  if (["BR_SQUAD", "CS_4V4"].includes(mode)) return 4;
  if (["BR_DUO", "LW_2V2"].includes(mode)) return 2;
  if (["BR_TRIO"].includes(mode)) return 3;
  return 1;
}

export function getTeamSizeFromTournament(tournament: any): number {
  return getTeamSizeFromMode(tournament?.mode ?? "");
}

export function TeamJoinSection({
  tournament,
  onTeammatesChange,
}: {
  tournament: any;
  onTeammatesChange: (teammates: Teammate[]) => void;
}) {
  const teamSize = getTeamSizeFromMode(tournament.mode);
  const slots = teamSize - 1;
  const [teammates, setTeammates] = useState<Teammate[]>(
    Array(slots).fill(null).map(() => ({ freefireUid: "", igName: "" })),
  );
  const [errors, setErrors] = useState<string[]>(Array(slots).fill(""));

  const update = (idx: number, field: keyof Teammate, value: string) => {
    const next = teammates.map((t, i) =>
      i === idx ? { ...t, [field]: value } : t,
    );
    setTeammates(next);
    if (field === "freefireUid") {
      const errs = [...errors];
      errs[idx] =
        /^\d{9,12}$/.test(value) || value === ""
          ? ""
          : "UID must be 9–12 digits";
      setErrors(errs);
    }
    onTeammatesChange(next);
  };

  const allValid = teammates.every(
    (t) => /^\d{9,12}$/.test(t.freefireUid) && t.igName.trim().length > 0,
  );

  return (
    <section className="fs-card mt-4 overflow-visible">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} style={{ color: "var(--fs-gold)" }} />
          <span
            className="text-xs font-bold uppercase"
            style={{ color: "var(--fs-text-2)" }}
          >
            Team Members
          </span>
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
            style={{
              background: "var(--fs-red-glow)",
              color: "var(--fs-red)",
            }}
          >
            REQUIRED
          </span>
        </div>

        {/* Captain slot */}
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background: "var(--fs-surface-2)",
            border: "1px solid var(--fs-border)",
          }}
        >
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--fs-text-2)" }}
          >
            Slot 1 — You (Captain)
          </p>
          <p
            className="text-[11px] mt-1"
            style={{ color: "var(--fs-green)" }}
          >
            Auto-filled from your profile ✓
          </p>
        </div>

        {/* Teammate slots */}
        {Array(slots)
          .fill(null)
          .map((_, i) => (
            <div
              key={i}
              className="rounded-lg p-3 mb-3"
              style={{
                background: "var(--fs-surface-2)",
                border: `1px solid ${errors[i] ? "var(--fs-red)" : "var(--fs-border)"}`,
              }}
            >
              <p
                className="text-xs font-semibold mb-2"
                style={{ color: "var(--fs-text-2)" }}
              >
                Slot {i + 2} — Teammate {i + 1}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className="text-[10px] uppercase font-semibold"
                    style={{ color: "var(--fs-text-3)" }}
                  >
                    Free Fire UID *
                  </label>
                  <input
                    placeholder="e.g. 123456789"
                    value={teammates[i].freefireUid}
                    onChange={(e) =>
                      update(i, "freefireUid", e.target.value)
                    }
                    className="input mt-1"
                    style={{ fontSize: 14 }}
                  />
                  {errors[i] && (
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "var(--fs-red)" }}
                    >
                      {errors[i]}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    className="text-[10px] uppercase font-semibold"
                    style={{ color: "var(--fs-text-3)" }}
                  >
                    In-Game Name *
                  </label>
                  <input
                    placeholder="IGN"
                    value={teammates[i].igName}
                    onChange={(e) => update(i, "igName", e.target.value)}
                    className="input mt-1"
                    style={{ fontSize: 14 }}
                  />
                </div>
              </div>
            </div>
          ))}

        {!allValid &&
          teammates.some((t) => t.freefireUid || t.igName) && (
            <p
              className="text-xs text-center py-2"
              style={{ color: "var(--fs-amber)" }}
            >
              Fill all teammate UIDs and names to join
            </p>
          )}
      </div>
    </section>
  );
}
