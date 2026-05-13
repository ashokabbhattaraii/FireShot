"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { PageLoading } from "@/components/ui";

interface Flag {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  group: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

const GROUP_ORDER = ["SYSTEM", "TOURNAMENTS", "CHALLENGES", "PAYMENTS", "SUPPORT", "NOTIFICATIONS"];

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    try {
      const data = await api<Flag[]>("/admin/flags");
      setFlags(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(key: string, enabled: boolean) {
    if (key === "MAINTENANCE_MODE" && enabled) {
      setConfirmKey(key);
      return;
    }
    await doToggle(key, enabled);
  }

  async function doToggle(key: string, enabled: boolean) {
    setConfirmKey(null);
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));
    try {
      await api(`/admin/flags/${key}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch (e: any) {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
      toast.error(e.message ?? "Failed to toggle flag");
    }
  }

  if (loading) return <PageLoading label="Loading feature flags..." />;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: flags.filter((f) => f.group === group),
  })).filter((g) => g.items.length > 0);

  const maintenanceActive = flags.find((f) => f.key === "MAINTENANCE_MODE")?.enabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="fs-h1">Feature Flags</h1>
        <p className="fs-caption mt-1">Toggle platform features on/off instantly</p>
      </div>

      {maintenanceActive && (
        <div
          className="rounded-lg p-4 flex items-center justify-between"
          style={{ background: "rgba(229,57,53,0.12)", border: "1px solid var(--fs-red)" }}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--fs-red)" }}>
              MAINTENANCE MODE IS ACTIVE
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--fs-text-3)" }}>
              Users cannot access the app right now
            </p>
          </div>
          <button
            className="fs-btn fs-btn-sm"
            style={{ background: "var(--fs-red)", color: "#fff" }}
            onClick={() => doToggle("MAINTENANCE_MODE", false)}
          >
            Disable Now
          </button>
        </div>
      )}

      {grouped.map(({ group, items }) => (
        <section key={group}>
          <h2
            className="text-xs font-bold uppercase tracking-wide mb-3"
            style={{ color: "var(--fs-text-3)" }}
          >
            {group}
          </h2>
          <div className="space-y-2">
            {items.map((flag) => (
              <div
                key={flag.key}
                className="fs-card flex items-center justify-between p-4"
                style={{
                  border: flag.key === "MAINTENANCE_MODE" && flag.enabled
                    ? "1px solid var(--fs-red)"
                    : undefined,
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--fs-text-1)" }}>
                    {flag.label}
                  </p>
                  {flag.description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--fs-text-3)" }}>
                      {flag.description}
                    </p>
                  )}
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={(e) => toggle(flag.key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div
                    className="w-11 h-6 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                    style={{
                      background: flag.enabled ? "var(--fs-green)" : "var(--fs-surface-3)",
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Maintenance confirm dialog */}
      {confirmKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div className="fs-card fs-card-body w-full text-center" style={{ maxWidth: 380 }}>
            <h3 className="fs-h3">Enable Maintenance Mode?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--fs-text-2)" }}>
              All users will see a maintenance screen immediately.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                className="fs-btn fs-btn-outline flex-1"
                onClick={() => setConfirmKey(null)}
              >
                Cancel
              </button>
              <button
                className="fs-btn flex-1"
                style={{ background: "var(--fs-red)", color: "#fff" }}
                onClick={() => doToggle("MAINTENANCE_MODE", true)}
              >
                Enable Maintenance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
