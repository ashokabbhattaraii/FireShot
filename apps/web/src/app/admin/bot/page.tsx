"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  Bot,
  Play,
  Save,
  RefreshCw,
  Shield,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Undo2,
} from "lucide-react";
import { ButtonLoading, CardGridSkeleton, TableLoading } from "@/components/ui";

interface BotJob {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  intervalMins: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunLog: string | null;
  runCount: number;
  errorCount: number;
  nextRunAt: string | null;
  dryRunEnabled: boolean;
  maxActionsPerRun: number;
  accuracyScore: number;
  truePositives: number;
  falsePositives: number;
  config: Record<string, any>;
}

interface Flag {
  id: string;
  jobName: string;
  targetType: string;
  targetId: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: any;
  status: string;
  wasCorrect: boolean | null;
  createdAt: string;
}

interface Rollback {
  id: string;
  jobName: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState: any;
  afterState: any;
  rolledBack: boolean;
  rolledBackAt: string | null;
  createdAt: string;
}

interface BotLog {
  id: string;
  jobName: string;
  status: "SUCCESS" | "FAILED";
  summary: string;
  durationMs: number;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "bg-neon-green/20 text-neon-green border-neon-green/40",
  FAILED: "bg-red-500/20 text-red-400 border-red-500/40",
  RUNNING: "bg-amber-400/20 text-amber-300 border-amber-400/40 animate-pulse",
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-amber-400/20 text-amber-300 border-amber-400/40",
  MEDIUM: "bg-blue-400/20 text-blue-300 border-blue-400/40",
  LOW: "bg-white/10 text-white/60 border-border",
};

export default function AdminBot() {
  const [jobs, setJobs] = useState<BotJob[]>([]);
  const [flags, setFlags] = useState<{ items: Flag[]; total: number }>({ items: [], total: 0 });
  const [rollbacks, setRollbacks] = useState<{ items: Rollback[]; total: number }>({ items: [], total: 0 });
  const [logs, setLogs] = useState<{ items: BotLog[]; total: number }>({ items: [], total: 0 });
  const [flagTab, setFlagTab] = useState<"PENDING" | "REVIEWED" | "ALL">("PENDING");
  const [intervalDrafts, setIntervalDrafts] = useState<Record<string, number>>({});
  const [maxActDrafts, setMaxActDrafts] = useState<Record<string, number>>({});
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logPage, setLogPage] = useState(1);
  const [logFilter, setLogFilter] = useState("");
  const [jobsLoading, setJobsLoading] = useState(true);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [rollbacksLoading, setRollbacksLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  async function loadJobs(showLoading = true) {
    if (showLoading) setJobsLoading(true);
    try {
      const j = await api<BotJob[]>("/admin/bot/jobs");
      setJobs(j);
      const idr: Record<string, number> = {};
      const mar: Record<string, number> = {};
      const cdr: Record<string, string> = {};
      j.forEach((x) => {
        idr[x.name] = x.intervalMins;
        mar[x.name] = x.maxActionsPerRun;
        cdr[x.name] = JSON.stringify(x.config ?? {}, null, 2);
      });
      setIntervalDrafts(idr);
      setMaxActDrafts(mar);
      setConfigDrafts(cdr);
    } finally {
      if (showLoading) setJobsLoading(false);
    }
  }
  async function loadFlags(showLoading = true) {
    if (showLoading) setFlagsLoading(true);
    const params = new URLSearchParams();
    if (flagTab === "PENDING") params.set("status", "PENDING");
    if (flagTab === "REVIEWED") params.set("status", "REVIEWED_CORRECT");
    try {
      setFlags(await api(`/admin/bot/flags?${params}`));
    } finally {
      if (showLoading) setFlagsLoading(false);
    }
  }
  async function loadRollbacks(showLoading = true) {
    if (showLoading) setRollbacksLoading(true);
    try {
      setRollbacks(await api("/admin/bot/rollbacks"));
    } finally {
      if (showLoading) setRollbacksLoading(false);
    }
  }
  async function loadLogs(showLoading = true) {
    if (showLoading) setLogsLoading(true);
    try {
      setLogs(
        await api(
          `/admin/bot/logs?page=${logPage}&limit=20${logFilter ? `&jobName=${logFilter}` : ""}`,
        ),
      );
    } finally {
      if (showLoading) setLogsLoading(false);
    }
  }
  async function loadAll() {
    setRefreshing(true);
    try {
      await Promise.all([loadJobs(), loadFlags(), loadRollbacks(), loadLogs()]);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { loadAll().catch(() => {}); }, []);
  useEffect(() => { loadFlags().catch(() => {}); }, [flagTab]);
  useEffect(() => { loadLogs().catch(() => {}); }, [logPage, logFilter]);

  async function toggle(name: string, enabled: boolean) {
    setActionKey(`${name}:toggle`);
    try {
      await api(`/admin/bot/jobs/${name}/toggle`, { method: "PUT", body: JSON.stringify({ enabled }) });
      await loadJobs(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionKey(null);
    }
  }
  async function toggleDryRun(name: string, dryRun: boolean) {
    setActionKey(`${name}:dry-run`);
    try {
      await api(`/admin/bot/jobs/${name}/dry-run`, { method: "PUT", body: JSON.stringify({ dryRun }) });
      await loadJobs(false);
    } finally {
      setActionKey(null);
    }
  }
  async function saveInterval(name: string) {
    setActionKey(`${name}:interval`);
    try {
      await api(`/admin/bot/jobs/${name}/interval`, {
        method: "PUT",
        body: JSON.stringify({ intervalMins: intervalDrafts[name] }),
      });
      await loadJobs(false);
    } finally {
      setActionKey(null);
    }
  }
  async function saveMaxActions(name: string) {
    setActionKey(`${name}:max-actions`);
    try {
      await api(`/admin/bot/jobs/${name}/max-actions`, {
        method: "PUT",
        body: JSON.stringify({ maxActionsPerRun: maxActDrafts[name] }),
      });
      await loadJobs(false);
    } finally {
      setActionKey(null);
    }
  }
  async function saveConfig(name: string) {
    let parsed: any;
    try { parsed = JSON.parse(configDrafts[name]); } catch { return alert("Invalid JSON"); }
    setActionKey(`${name}:config`);
    try {
      await api(`/admin/bot/jobs/${name}/config`, {
        method: "PUT",
        body: JSON.stringify({ config: parsed }),
      });
      await loadJobs(false);
    } finally {
      setActionKey(null);
    }
  }
  async function runNow(name: string) {
    setActionKey(`${name}:run`);
    try {
      await api(`/admin/bot/jobs/${name}/run`, { method: "POST" });
      setTimeout(loadAll, 1500);
    } finally {
      setActionKey(null);
    }
  }
  async function reviewFlag(id: string, wasCorrect: boolean) {
    setActionKey(`${id}:flag`);
    try {
      await api(`/admin/bot/flags/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ wasCorrect }),
      });
      await Promise.all([loadJobs(false), loadFlags(false)]);
    } finally {
      setActionKey(null);
    }
  }
  async function ignoreFlag(id: string) {
    setActionKey(`${id}:ignore`);
    try {
      await api(`/admin/bot/flags/${id}/ignore`, { method: "POST" });
      await loadFlags(false);
    } finally {
      setActionKey(null);
    }
  }
  async function doRollback(id: string) {
    if (!confirm("Roll back this action? This cannot be undone.")) return;
    setActionKey(`${id}:rollback`);
    try {
      await api(`/admin/bot/rollback/${id}`, { method: "POST" });
      await loadRollbacks(false);
    } finally {
      setActionKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Admin</p>
          <h1 className="font-display text-2xl flex items-center gap-2"><Bot /> Bot Control Center</h1>
        </div>
        <button onClick={loadAll} className="btn-outline" disabled={refreshing}>
          <ButtonLoading loading={refreshing} loadingText="Refreshing...">
            <RefreshCw size={14} /> Refresh
          </ButtonLoading>
        </button>
      </div>

      {/* SECTION 1: Job Control */}
      <section className="space-y-3">
        <h2 className="label">Job Control</h2>
        {jobsLoading ? (
          <CardGridSkeleton count={4} />
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map((j) => {
            const total = j.truePositives + j.falsePositives;
            const ringColor =
              j.accuracyScore > 80 ? "stroke-neon-green" : j.accuracyScore > 60 ? "stroke-amber-400" : "stroke-red-500";
            const ringPct = Math.max(0, Math.min(100, j.accuracyScore));
            const status = j.lastRunStatus ?? "NEVER";
            const isExpanded = expanded[j.name];
            return (
              <div key={j.id} className="card">
                <div className="flex items-start gap-3">
                  <AccuracyRing pct={ringPct} colorCls={ringColor} reviews={total} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base">{j.name}</h3>
                      {j.isEnabled ? (
                        <span className="text-[10px] text-neon-green">● ENABLED</span>
                      ) : (
                        <span className="text-[10px] text-white/40">● DISABLED</span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-1">{j.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      {j.dryRunEnabled ? (
                        <span className="px-2 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-300">
                          DRY RUN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400">
                          ⚠ REAL ACTIONS
                        </span>
                      )}
                      {status !== "NEVER" && (
                        <span className={`px-2 py-0.5 rounded border ${STATUS_COLOR[status] ?? ""}`}>
                          {status}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded border border-border bg-surface text-white/60">
                        TP {j.truePositives} / FP {j.falsePositives}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <ToggleRow
                    label="Enabled"
                    checked={j.isEnabled}
                    onChange={(v) => toggle(j.name, v)}
                    disabled={(j.dryRunEnabled && !j.isEnabled) || actionKey?.startsWith(`${j.name}:`)}
                    hint={j.dryRunEnabled ? "Disable Dry Run first" : undefined}
                  />
                  <ToggleRow
                    label="Dry Run (no DB writes)"
                    checked={j.dryRunEnabled}
                    onChange={(v) => toggleDryRun(j.name, v)}
                    disabled={actionKey?.startsWith(`${j.name}:`)}
                    accent="amber"
                  />
                </div>

                {j.lastRunLog && (
                  <p className="mt-3 rounded-md border border-border bg-surface/50 p-2 text-xs text-white/70 italic">
                    {j.lastRunLog}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 items-center text-xs">
                  <span className="text-white/60">Every</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={intervalDrafts[j.name] ?? j.intervalMins}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const next = digits ? Number(digits) : 5;
                      setIntervalDrafts((d) => ({
                        ...d,
                        [j.name]: Math.max(5, Math.min(1440, next)),
                      }));
                    }}
                    className="input w-20"
                  />
                  <span className="text-white/60">mins</span>
                  <button
                    className="btn-outline text-xs"
                    disabled={intervalDrafts[j.name] === j.intervalMins || actionKey?.startsWith(`${j.name}:`)}
                    onClick={() => saveInterval(j.name)}
                  >
                    <ButtonLoading loading={actionKey === `${j.name}:interval`} loadingText="Saving...">
                      <Save size={12} /> Save
                    </ButtonLoading>
                  </button>
                  <span className="text-white/60 ml-2">Max actions</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={maxActDrafts[j.name] ?? j.maxActionsPerRun}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const next = digits ? Number(digits) : 1;
                      setMaxActDrafts((d) => ({
                        ...d,
                        [j.name]: Math.max(1, Math.min(10000, next)),
                      }));
                    }}
                    className="input w-20"
                  />
                  <button
                    className="btn-outline text-xs"
                    disabled={maxActDrafts[j.name] === j.maxActionsPerRun || actionKey?.startsWith(`${j.name}:`)}
                    onClick={() => saveMaxActions(j.name)}
                  >
                    <ButtonLoading loading={actionKey === `${j.name}:max-actions`} loadingText="Saving...">
                      <Save size={12} />
                    </ButtonLoading>
                  </button>
                  <button
                    className="btn-primary text-xs ml-auto"
                    onClick={() => runNow(j.name)}
                    disabled={actionKey?.startsWith(`${j.name}:`)}
                  >
                    <ButtonLoading loading={actionKey === `${j.name}:run`} loadingText="Starting...">
                      <Play size={12} /> Run Now
                    </ButtonLoading>
                  </button>
                </div>

                <button
                  onClick={() => setExpanded((e) => ({ ...e, [j.name]: !e[j.name] }))}
                  className="mt-2 text-xs text-neon-cyan flex items-center gap-1"
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Config
                </button>
                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      className="input font-mono text-xs"
                      rows={6}
                      value={configDrafts[j.name] ?? ""}
                      onChange={(e) => setConfigDrafts((d) => ({ ...d, [j.name]: e.target.value }))}
                    />
                    <button
                      className="btn-primary text-xs"
                      onClick={() => saveConfig(j.name)}
                      disabled={actionKey?.startsWith(`${j.name}:`)}
                    >
                      <ButtonLoading loading={actionKey === `${j.name}:config`} loadingText="Saving...">
                        <Save size={12} /> Save Config
                      </ButtonLoading>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </section>

      {/* SECTION 2: Flags */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" /> Flags ({flags.total})
          </h2>
          <div className="flex gap-1 text-xs">
            {(["PENDING", "REVIEWED", "ALL"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFlagTab(t)}
                className={`px-3 py-1 rounded-md ${flagTab === t ? "bg-neon text-black" : "bg-surface text-white/70"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {flagsLoading ? (
            <TableLoading columns={7} rows={5} />
          ) : (
          <table className="data-table text-xs">
            <thead>
              <tr><th>Time</th><th>Job</th><th>Target</th><th>Reason</th><th>Severity</th><th>Evidence</th><th>Action</th></tr>
            </thead>
            <tbody>
              {flags.items.map((f) => (
                <tr key={f.id}>
                  <td className="text-white/60">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="font-mono text-neon-cyan">{f.jobName}</td>
                  <td className="font-mono text-[10px]">{f.targetType}/{f.targetId.slice(0, 8)}</td>
                  <td>{f.reason}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded border text-[10px] ${SEVERITY_COLOR[f.severity]}`}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="max-w-xs truncate text-white/60 font-mono text-[10px]">
                    {JSON.stringify(f.evidence).slice(0, 80)}
                  </td>
                  <td>
                    {f.wasCorrect === null ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => reviewFlag(f.id, true)}
                          className="btn-outline text-[10px]"
                          title="Mark as correct"
                          disabled={actionKey?.startsWith(`${f.id}:`)}
                        >
                          <ButtonLoading loading={actionKey === `${f.id}:flag`} loadingText="Saving...">
                            <Check size={10} className="text-neon-green" />
                          </ButtonLoading>
                        </button>
                        <button
                          onClick={() => reviewFlag(f.id, false)}
                          className="btn-outline text-[10px]"
                          title="Mark as wrong"
                          disabled={actionKey?.startsWith(`${f.id}:`)}
                        >
                          <ButtonLoading loading={actionKey === `${f.id}:flag`} loadingText="Saving...">
                            <X size={10} className="text-red-400" />
                          </ButtonLoading>
                        </button>
                        <button
                          onClick={() => ignoreFlag(f.id)}
                          className="btn-outline text-[10px]"
                          title="Ignore"
                          disabled={actionKey?.startsWith(`${f.id}:`)}
                        >
                          <ButtonLoading loading={actionKey === `${f.id}:ignore`} loadingText="Ignoring...">
                            –
                          </ButtonLoading>
                        </button>
                      </div>
                    ) : (
                      <span className={f.wasCorrect ? "text-neon-green text-[10px]" : "text-red-400 text-[10px]"}>
                        {f.wasCorrect ? "✓ Correct" : "✗ Wrong"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {flags.items.length === 0 && (
                <tr><td colSpan={7} className="text-center text-white/40 py-4">No flags</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </section>

      {/* SECTION 3: Rollbacks */}
      <section className="card">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2">
          <Undo2 size={18} /> Rollback Log ({rollbacks.total})
        </h2>
        <div className="overflow-x-auto">
          {rollbacksLoading ? (
            <TableLoading columns={7} rows={5} />
          ) : (
          <table className="data-table text-xs">
            <thead>
              <tr><th>Time</th><th>Job</th><th>Action</th><th>Target</th><th>Diff</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rollbacks.items.map((r) => (
                <tr key={r.id}>
                  <td className="text-white/60">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="font-mono text-neon-cyan">{r.jobName}</td>
                  <td>{r.action}</td>
                  <td className="font-mono text-[10px]">{r.targetType}/{r.targetId.slice(0, 8)}</td>
                  <td className="max-w-xs truncate font-mono text-[10px] text-white/60">
                    <span className="text-red-300">{JSON.stringify(r.beforeState).slice(0, 40)}</span>
                    {" → "}
                    <span className="text-neon-green">{JSON.stringify(r.afterState).slice(0, 40)}</span>
                  </td>
                  <td>
                    {r.rolledBack ? (
                      <span className="text-[10px] text-white/50">Reverted</span>
                    ) : (
                      <span className="text-[10px] text-neon-cyan">Active</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => doRollback(r.id)}
                      disabled={r.rolledBack || actionKey?.startsWith(`${r.id}:`)}
                      className="btn-outline text-[10px] disabled:opacity-40"
                    >
                      <ButtonLoading loading={actionKey === `${r.id}:rollback`} loadingText="Rolling back...">
                        <Undo2 size={10} /> Rollback
                      </ButtonLoading>
                    </button>
                  </td>
                </tr>
              ))}
              {rollbacks.items.length === 0 && (
                <tr><td colSpan={7} className="text-center text-white/40 py-4">No rollback records</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </section>

      {/* Bot Logs */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Run Logs</h2>
          <select className="input w-48" value={logFilter} onChange={(e) => { setLogFilter(e.target.value); setLogPage(1); }}>
            <option value="">All jobs</option>
            {jobs.map((j) => <option key={j.name} value={j.name}>{j.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          {logsLoading ? (
            <TableLoading columns={5} rows={6} />
          ) : (
          <table className="data-table text-xs">
            <thead>
              <tr><th>Time</th><th>Job</th><th>Status</th><th>Duration</th><th>Summary</th></tr>
            </thead>
            <tbody>
              {logs.items.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="font-mono text-neon-cyan">{l.jobName}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded border text-[10px] ${STATUS_COLOR[l.status] ?? ""}`}>
                      {l.status}
                    </span>
                  </td>
                  <td>{l.durationMs}ms</td>
                  <td className="text-white/80">{l.summary}</td>
                </tr>
              ))}
              {logs.items.length === 0 && (
                <tr><td colSpan={5} className="text-center text-white/40 py-4">No logs</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button disabled={logsLoading || logPage <= 1} onClick={() => setLogPage(logPage - 1)} className="btn-outline">Prev</button>
          <span className="text-sm text-white/60">Page {logPage} of {Math.max(1, Math.ceil(logs.total / 20))}</span>
          <button disabled={logsLoading || logs.items.length < 20} onClick={() => setLogPage(logPage + 1)} className="btn-outline">Next</button>
        </div>
      </section>
    </div>
  );
}

function AccuracyRing({ pct, colorCls, reviews }: { pct: number; colorCls: string; reviews: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 60 60" className="w-14 h-14 -rotate-90">
        <circle cx="30" cy="30" r={r} className="stroke-border" strokeWidth="6" fill="none" />
        <circle
          cx="30" cy="30" r={r}
          className={colorCls}
          strokeWidth="6" fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold text-white">{Math.round(pct)}%</span>
        <span className="text-[8px] text-white/40">{reviews}rv</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label, checked, onChange, disabled, hint, accent,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; hint?: string; accent?: "amber";
}) {
  const trackOn = accent === "amber" ? "bg-amber-400" : "bg-neon";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md border border-border bg-surface/50 px-2 py-1 ${disabled ? "opacity-50" : ""}`}>
      <div className="text-white/80">
        {label}
        {hint && <p className="text-[9px] text-white/40">{hint}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`w-9 h-5 bg-border rounded-full peer transition peer-checked:${trackOn}`} />
        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white peer-checked:translate-x-4 transition" />
      </label>
    </div>
  );
}
