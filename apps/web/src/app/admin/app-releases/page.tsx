"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api, FILE_BASE } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FlaskConical,
  Rocket,
  Save,
  Smartphone,
  TerminalSquare,
  Upload,
  XCircle,
} from "lucide-react";
import { ButtonLoading, CardGridSkeleton, TableLoading } from "@/components/ui";

type CheckStatus = "PASS" | "FAIL" | "WARN" | "INFO";

interface ReleaseCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  required?: boolean;
}

interface TestReport {
  status: string;
  summary: string;
  checkedAt: string;
  checks: ReleaseCheck[];
}

interface AppRelease {
  id: string;
  version: string;
  releaseNotes: string | null;
  filename: string;
  downloadCount: number;
  isLatest: boolean;
  buildStatus: string;
  testStatus: string;
  testReport?: TestReport | null;
  fileSizeBytes?: number | null;
  sha256?: string | null;
  buildLog?: string | null;
  builtAt?: string | null;
  testedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

interface BuildInfo {
  canBuild: boolean;
  hasAppUrl: boolean;
  appUrl: string | null;
  apiUrl: string | null;
  nativeLoadMode: "bundled" | "remote";
  remoteServerUrl: string | null;
  currentBuildRunning: boolean;
  downloadsDir: string;
}

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
  category: string;
  label: string;
  updatedAt: string;
}

const APP_RUNTIME_SETTINGS: Array<{
  key: string;
  label: string;
  type: "STRING" | "BOOLEAN";
  placeholder?: string;
}> = [
  {
    key: "APP_API_URL",
    label: "Public API URL",
    type: "STRING",
    placeholder: "https://your-api.vercel.app/api",
  },
  {
    key: "APP_PUBLIC_WEB_URL",
    label: "Public Web URL",
    type: "STRING",
    placeholder: "https://your-web.vercel.app",
  },
  {
    key: "APP_MIN_ANDROID_VERSION",
    label: "Minimum Android Version",
    type: "STRING",
    placeholder: "1.0.1",
  },
  {
    key: "APP_LATEST_VERSION",
    label: "Fallback Latest Version",
    type: "STRING",
    placeholder: "1.0.1",
  },
  {
    key: "APP_FORCE_UPDATE_ENABLED",
    label: "Force Android Update",
    type: "BOOLEAN",
  },
  {
    key: "APP_DOWNLOAD_ENABLED",
    label: "Download Enabled",
    type: "BOOLEAN",
  },
  {
    key: "APP_MAINTENANCE_ENABLED",
    label: "App Maintenance",
    type: "BOOLEAN",
  },
  {
    key: "APP_MAINTENANCE_MESSAGE",
    label: "Maintenance Message",
    type: "STRING",
    placeholder: "FireSlot Nepal is updating. Please try again soon.",
  },
];

const APP_RUNTIME_DEFAULTS: Record<string, string> = {
  APP_API_URL: "",
  APP_PUBLIC_WEB_URL: "",
  APP_MIN_ANDROID_VERSION: "1.0.0",
  APP_LATEST_VERSION: "1.0.0",
  APP_FORCE_UPDATE_ENABLED: "false",
  APP_DOWNLOAD_ENABLED: "true",
  APP_MAINTENANCE_ENABLED: "false",
  APP_MAINTENANCE_MESSAGE: "FireSlot Nepal is updating. Please try again soon.",
};

export default function AdminAppReleases() {
  const [items, setItems] = useState<AppRelease[]>([]);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [version, setVersion] = useState("1.0.0");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [apkUrl, setApkUrl] = useState("");
  const [runtimeDrafts, setRuntimeDrafts] = useState<Record<string, string>>(() => defaultRuntimeDrafts());
  const [building, setBuilding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const latest = useMemo(() => items.find((item) => item.isLatest), [items]);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [info, releases, configGroups] = await Promise.all([
        api<BuildInfo>("/admin/app-releases/build-info"),
        api<AppRelease[]>("/admin/app-releases"),
        api<Record<string, ConfigItem[]>>("/admin/config").catch(() => null),
      ]);
      setBuildInfo(info);
      setItems(releases);
      if (configGroups) {
        setRuntimeDrafts(flattenConfig(configGroups));
      }
      if (releases.length && version === "1.0.0") {
        setVersion(nextPatch(releases[0].version));
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBuilding(true);
    setMsg("Compiling Android APK. Keep this page open.");
    try {
      const release = await api<AppRelease>("/admin/app-releases/generate", {
        method: "POST",
        body: JSON.stringify({ version, releaseNotes: notes, runTests: true }),
      });
      setMsg(
        release.testStatus === "PASSED"
          ? "Build passed tests. Ready to push for download."
          : "Build finished, but tests need attention.",
      );
      setNotes("");
      setExpandedId(release.id);
      await load(false);
    } catch (e: any) {
      setMsg(e.message || "Build failed.");
    } finally {
      setBuilding(false);
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const cleanApkUrl = apkUrl.trim();
    if (!file && !cleanApkUrl) return setMsg("Pick an APK file or paste a public APK URL.");
    if (cleanApkUrl && !/^https?:\/\//.test(cleanApkUrl)) {
      return setMsg("APK URL must start with http:// or https://.");
    }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      if (file) fd.append("apk", file);
      if (!file && cleanApkUrl) fd.append("apkUrl", cleanApkUrl);
      fd.append("version", version);
      fd.append("releaseNotes", notes);
      await api("/admin/app-releases", { method: "POST", body: fd });
      setMsg("APK saved as draft. Run tests before pushing it live.");
      setFile(null);
      setApkUrl("");
      setNotes("");
      await load(false);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveRuntimeSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingRuntime(true);
    setMsg(null);
    try {
      await api("/admin/config/bulk", {
        method: "POST",
        body: JSON.stringify({
          updates: APP_RUNTIME_SETTINGS.map((setting) => ({
            key: setting.key,
            value: runtimeDrafts[setting.key] ?? "",
          })),
        }),
      });
      setMsg("App settings saved.");
      await load(false);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSavingRuntime(false);
    }
  }

  async function runTests(id: string) {
    setTestingId(id);
    setMsg("Running system checks...");
    try {
      const release = await api<AppRelease>(`/admin/app-releases/${id}/test`, {
        method: "POST",
      });
      setMsg(
        release.testStatus === "PASSED"
          ? "System checks passed. Release can be pushed."
          : "System checks failed. Review the report before publishing.",
      );
      setExpandedId(id);
      await load(false);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setTestingId(null);
    }
  }

  async function pushForDownload(id: string) {
    setPublishingId(id);
    setMsg(null);
    try {
      await api(`/admin/app-releases/${id}/latest`, {
        method: "PUT",
        body: JSON.stringify({ isLatest: true }),
      });
      setMsg("Release pushed to public download.");
      await load(false);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label">Admin</p>
          <h1 className="font-display text-2xl flex items-center gap-2">
            <Smartphone /> App Releases
          </h1>
        </div>
        {latest && (
          <a href={downloadHref(latest)} className="btn-outline text-xs" download>
            <Download size={14} /> Current v{latest.version}
          </a>
        )}
      </div>

      {msg && (
        <div className="rounded-lg border border-border bg-card/70 px-4 py-3 text-xs text-white/70">
          {msg}
        </div>
      )}

      {loading ? (
        <CardGridSkeleton count={5} />
      ) : (
      <div className="grid gap-3 md:grid-cols-5">
        <SystemTile
          label="Build mode"
          ok={!!buildInfo?.canBuild}
          value={buildInfo?.canBuild ? "Server compiler ready" : "Manual APK upload"}
          soft={!buildInfo?.canBuild}
        />
        <SystemTile
          label="Native load mode"
          ok={buildInfo?.nativeLoadMode !== "remote"}
          value={buildInfo?.nativeLoadMode === "remote" ? "Remote URL" : "Bundled app"}
        />
        <SystemTile
          label="API URL"
          ok={!!buildInfo?.apiUrl?.startsWith("https://")}
          value={buildInfo?.apiUrl ?? "Not configured"}
        />
        <SystemTile
          label="Public web URL"
          ok={!!buildInfo?.appUrl?.startsWith("https://")}
          value={buildInfo?.appUrl ?? "Optional"}
          soft
        />
        <SystemTile
          label="Build queue"
          ok={!buildInfo?.currentBuildRunning}
          value={buildInfo?.currentBuildRunning ? "Running" : "Idle"}
        />
      </div>
      )}

      <form onSubmit={saveRuntimeSettings} className="card space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-lg flex items-center gap-2">
              <Save size={18} /> App Update Controls
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Set the URLs and rollout gates the installed Android app reads at startup.
            </p>
          </div>
          <button className="btn-primary" disabled={savingRuntime} type="submit">
            <ButtonLoading loading={savingRuntime} loadingText="Saving...">
              <Save size={14} /> Save Settings
            </ButtonLoading>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {APP_RUNTIME_SETTINGS.map((setting) => (
            <RuntimeSettingInput
              key={setting.key}
              setting={setting}
              value={runtimeDrafts[setting.key] ?? ""}
              onChange={(value) => setRuntimeDrafts((drafts) => ({ ...drafts, [setting.key]: value }))}
            />
          ))}
        </div>
      </form>

      <form onSubmit={generate} className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <TerminalSquare size={18} /> Compile Latest Android App
          </h2>
          <span className="rounded border border-border bg-surface px-2 py-1 text-[10px] text-white/60">
            Build + Sync + Gradle + Tests
          </span>
        </div>
        <ReleaseFields
          version={version}
          notes={notes}
          setVersion={setVersion}
          setNotes={setNotes}
        />
        {!buildInfo?.canBuild && (
          <div className="rounded-md border border-neon-orange/30 bg-neon-orange/10 p-3 text-xs text-neon-orange">
            This server cannot compile Android APKs. Upload an APK file or paste a hosted APK URL below.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={building || !buildInfo?.canBuild} type="submit">
            <ButtonLoading loading={building} loadingText="Compiling...">
              <Rocket size={14} /> Compile, Test & Save Draft
            </ButtonLoading>
          </button>
        </div>
      </form>

      <form onSubmit={upload} className="card space-y-3">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Upload size={18} /> Manual APK Draft
        </h2>
        <ReleaseFields
          version={version}
          notes={notes}
          setVersion={setVersion}
          setNotes={setNotes}
        />
        <div>
          <label className="label">APK File</label>
          <input
            type="file"
            accept=".apk"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
          />
        </div>
        <div>
          <label className="label">Hosted APK URL</label>
          <input
            className="input"
            value={apkUrl}
            onChange={(e) => setApkUrl(e.target.value)}
            placeholder="https://example.com/fireslot-nepal.apk"
          />
        </div>
        <button className="btn-outline" disabled={uploading} type="submit">
          <ButtonLoading loading={uploading} loadingText="Uploading...">
            <Upload size={14} /> Save Draft
          </ButtonLoading>
        </button>
      </form>

      <div className="table-wrap">
        {loading ? (
          <TableLoading columns={7} rows={6} />
        ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Pipeline</th>
              <th>APK</th>
              <th>Size</th>
              <th>Downloads</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="font-mono">
                    v{r.version}
                    {r.isLatest && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-[10px] text-neon-green">
                        <CheckCircle2 size={10} /> Live
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Pill label={r.buildStatus} />
                      <Pill label={r.testStatus} status={r.testStatus} />
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate font-mono text-xs">
                    <a className="text-neon-cyan hover:underline" href={downloadHref(r)} download>
                      {displayFile(r.filename)}
                    </a>
                  </td>
                  <td>{formatBytes(r.fileSizeBytes)}</td>
                  <td>{r.downloadCount}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => runTests(r.id)}
                        disabled={testingId === r.id}
                        className="btn-outline text-xs"
                      >
                        <ButtonLoading loading={testingId === r.id} loadingText="Testing...">
                          <FlaskConical size={12} /> Test
                        </ButtonLoading>
                      </button>
                      <button
                        type="button"
                        onClick={() => pushForDownload(r.id)}
                        disabled={r.testStatus !== "PASSED" || publishingId === r.id || r.isLatest}
                        className="btn-primary text-xs disabled:opacity-40"
                        title={r.testStatus !== "PASSED" ? "Run and pass tests first" : "Push for download"}
                      >
                        <ButtonLoading loading={publishingId === r.id} loadingText="Pushing...">
                          <Rocket size={12} /> Push
                        </ButtonLoading>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="btn-outline text-xs"
                      >
                        Report
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr key={`${r.id}-report`}>
                    <td colSpan={7} className="bg-black/20">
                      <ReleaseReport release={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-white/40 py-6">
                  No releases yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function RuntimeSettingInput({
  setting,
  value,
  onChange,
}: {
  setting: (typeof APP_RUNTIME_SETTINGS)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label">{setting.label}</label>
      {setting.type === "BOOLEAN" ? (
        <select className="input" value={value || "false"} onChange={(e) => onChange(e.target.value)}>
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      ) : (
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={setting.placeholder}
        />
      )}
      <p className="mt-1 truncate font-mono text-[10px] text-white/35">{setting.key}</p>
    </div>
  );
}

function ReleaseFields({
  version,
  notes,
  setVersion,
  setNotes,
}: {
  version: string;
  notes: string;
  setVersion: (value: string) => void;
  setNotes: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className="label">Version</label>
        <input
          className="input"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          required
        />
      </div>
      <div>
        <label className="label">Release Notes</label>
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What changed?"
        />
      </div>
    </div>
  );
}

function SystemTile({
  label,
  value,
  ok,
  soft,
}: {
  label: string;
  value: string;
  ok: boolean;
  soft?: boolean;
}) {
  const Icon = ok ? CheckCircle2 : soft ? AlertTriangle : XCircle;
  return (
    <div className="rounded-lg border border-border bg-card/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label">{label}</p>
        <Icon size={16} className={ok ? "text-neon-green" : soft ? "text-neon-orange" : "text-red-300"} />
      </div>
      <p className="mt-2 truncate text-sm text-white">{value}</p>
    </div>
  );
}

function ReleaseReport({ release }: { release: AppRelease }) {
  const report = release.testReport;
  if (!report) {
    return (
      <div className="py-3 text-sm text-white/50">
        No test report yet. Run system tests before pushing this release.
      </div>
    );
  }
  return (
    <div className="space-y-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{report.summary}</p>
          <p className="text-xs text-white/50">
            Checked {new Date(report.checkedAt).toLocaleString()}
          </p>
        </div>
        {release.sha256 && (
          <span className="max-w-full truncate rounded border border-border px-2 py-1 font-mono text-[10px] text-white/50">
            sha256 {release.sha256}
          </span>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {report.checks.map((check) => (
          <div key={check.key} className="rounded-md border border-border bg-surface/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{check.label}</p>
              <Pill label={check.status} status={check.status} />
            </div>
            <p className="mt-1 break-words text-xs text-white/55">{check.detail}</p>
          </div>
        ))}
      </div>
      {release.buildLog && (
        <details className="rounded-md border border-border bg-black/30 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Build log
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[11px] text-white/60">
            {release.buildLog}
          </pre>
        </details>
      )}
    </div>
  );
}

function Pill({ label, status }: { label: string; status?: string }) {
  const tone =
    status === "PASSED" || status === "PASS" || label === "BUILT"
      ? "border-neon-green/40 bg-neon-green/10 text-neon-green"
      : status === "FAILED" || status === "FAIL" || label === "FAILED"
        ? "border-red-400/40 bg-red-500/10 text-red-300"
        : status === "WARN" || label === "TESTING" || label === "BUILDING"
          ? "border-neon-orange/40 bg-neon-orange/10 text-neon-orange"
          : "border-white/20 bg-white/5 text-white/60";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] ${tone}`}>
      {label}
    </span>
  );
}

function downloadHref(release: AppRelease) {
  return release.filename.startsWith("http")
    ? release.filename
    : `${FILE_BASE}/downloads/${release.filename}`;
}

function displayFile(filename: string) {
  if (!filename.startsWith("http")) return filename;
  try {
    return new URL(filename).pathname.split("/").pop() || filename;
  } catch {
    return filename;
  }
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function nextPatch(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return "1.0.0";
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function flattenConfig(groups: Record<string, ConfigItem[]>) {
  const drafts = defaultRuntimeDrafts();
  Object.values(groups)
    .flat()
    .forEach((item) => {
      if (APP_RUNTIME_SETTINGS.some((setting) => setting.key === item.key)) {
        drafts[item.key] = item.value;
      }
    });
  return drafts;
}

function defaultRuntimeDrafts() {
  const drafts: Record<string, string> = {};
  for (const setting of APP_RUNTIME_SETTINGS) {
    drafts[setting.key] = APP_RUNTIME_DEFAULTS[setting.key] ?? (setting.type === "BOOLEAN" ? "false" : "");
  }
  return drafts;
}
