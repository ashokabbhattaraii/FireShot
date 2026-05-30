"use client";
import { useEffect, useState } from "react";
import { api, FILE_BASE } from "@/lib/api";
import { ButtonLoading } from "@/components/ui";
import { Save, Upload, Check, Image } from "lucide-react";

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

const PAYMENT_METHODS = [
  { key: "esewa", label: "eSewa", color: "#60BB46" },
  { key: "khalti", label: "Khalti", color: "#5C2D91" },
  { key: "bank", label: "Bank Transfer", color: "#1565C0" },
];

const PRICING_KEYS = [
  "SYSTEM_FEE_PERCENT",
  "CHALLENGE_FEE_PERCENT",
  "WITHDRAWAL_FEE_PERCENT",
  "MAX_ENTRY_FEE",
  "MIN_ENTRY_FEE",
  "CS_EXPECTED_KILLS",
  "LW_EXPECTED_KILLS"
];
const WALLET_LIMIT_KEYS = ["MIN_DEPOSIT_AMOUNT_NPR", "MIN_WITHDRAWAL_AMOUNT_NPR"];
const APP_UPDATE_KEYS = ["APP_LATEST_VERSION", "APP_MIN_ANDROID_VERSION", "APP_FORCE_UPDATE_ENABLED", "APP_DOWNLOAD_ENABLED"];
const TIMING_KEYS = ["RESULT_SUBMIT_DELAY_MINS", "TOURNAMENT_LIVE_TO_PENDING_RESULTS_MINS", "AUTO_START_MINS_BEFORE", "PENDING_RESULTS_TO_COMPLETED_MINS"];
const AUTO_FLOW_KEYS = ["AUTO_STATUS_FLOW_ENABLED"];

export default function ConfigPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [sysDrafts, setSysDrafts] = useState<Record<string, string>>({});
  const [sysItems, setSysItems] = useState<Record<string, { key: string; value: string; label: string; type: string }[]>>({});
  const [savingSysKey, setSavingSysKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [data, sysData] = await Promise.all([
        api<ConfigItem[]>("/admin/app-config"),
        api<Record<string, { key: string, value: string, label: string, type: string }[]>>("/admin/config")
      ]);
      setItems(data);
      const d: Record<string, string> = {};
      data.forEach((c) => (d[c.key] = c.value));
      setDrafts(d);

      setSysItems(sysData);
      const sysD: Record<string, string> = {};
      Object.values(sysData).flat().forEach(c => sysD[c.key] = c.value);
      setSysDrafts(sysD);
    } finally { setLoading(false); }
  }

  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  async function save(key: string) {
    setSavingKey(key);
    setMsg(null);
    try {
      await api(`/admin/app-config/${key}`, { method: "PUT", body: JSON.stringify({ value: drafts[key] }) });
      setMsg("Saved successfully");
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setSavingKey(null); }
  }

  async function uploadQr(method: string, file: File) {
    setUploading(method);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("method", method);
      const result = await api<{ key: string; url: string }>("/admin/app-config/upload-qr", {
        method: "POST",
        body: fd,
      });
      setMsg(`QR for ${method} uploaded`);
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setUploading(null); }
  }

  async function saveSys(key: string) {
    setSavingSysKey(key);
    setMsg(null);
    try {
      await api(`/admin/config/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value: sysDrafts[key] }),
      });
      setMsg("Saved successfully");
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setSavingSysKey(null); }
  }

  const otherConfigs = items.filter(i => !i.key.startsWith("deposit_qr_") && !["deposit_account_id", "deposit_account_name", "deposit_instructions"].includes(i.key));
  const flatSysItems = Object.values(sysItems).flat();
  const pricingConfigs = flatSysItems.filter((config) => PRICING_KEYS.includes(config.key));
  const walletLimitConfigs = flatSysItems.filter((config) => WALLET_LIMIT_KEYS.includes(config.key));
  const timingConfigs = flatSysItems.filter((config) => TIMING_KEYS.includes(config.key));
  const autoFlowConfigs = flatSysItems.filter((config) => AUTO_FLOW_KEYS.includes(config.key));
  const appUpdateConfigs = flatSysItems.filter((config) => APP_UPDATE_KEYS.includes(config.key));

  const shownKeys = new Set<string>([
    ...PRICING_KEYS,
    ...WALLET_LIMIT_KEYS,
    ...TIMING_KEYS,
    ...AUTO_FLOW_KEYS,
    ...APP_UPDATE_KEYS,
  ]);
  const remainingSysConfigs = flatSysItems.filter((c) => !shownKeys.has(c.key));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--fs-text-1)" }}>Payment Configuration</h1>
        {msg && <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "var(--fs-green-dim)", color: "var(--fs-green)" }}>{msg}</span>}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="fs-skeleton" style={{ height: 100, borderRadius: 12 }} />)}
        </div>
      ) : (
        <>
          {/* QR Code Management */}
          <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Payment QR Codes</p>
              <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Upload QR code images for each payment method. Users will see the relevant QR when selecting a method.</p>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
              {PAYMENT_METHODS.map(m => {
                const qrUrl = drafts[`deposit_qr_${m.key}`] || "";
                return (
                  <div key={m.key} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: m.color, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {m.label}
                    </p>
                    {/* QR Preview */}
                    <div style={{
                      width: "100%", aspectRatio: "1", maxWidth: 160, margin: "0 auto",
                      background: qrUrl ? "#fff" : "var(--fs-surface-2)",
                      borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                      border: qrUrl ? "2px solid var(--fs-border)" : "2px dashed var(--fs-border-md)",
                      overflow: "hidden",
                    }}>
                      {qrUrl ? (
                        <img src={qrUrl} alt={`${m.label} QR`} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                      ) : (
                        <div style={{ textAlign: "center" }}>
                          <Image size={24} style={{ color: "var(--fs-text-3)", margin: "0 auto" }} />
                          <p style={{ fontSize: 10, color: "var(--fs-text-3)", marginTop: 4 }}>No QR set</p>
                        </div>
                      )}
                    </div>
                    {/* Upload Button */}
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                      padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "var(--fs-surface-2)", border: "1px solid var(--fs-border)",
                      color: "var(--fs-text-2)", cursor: "pointer",
                    }}>
                      {uploading === m.key ? (
                        <span>Uploading...</span>
                      ) : (
                        <>
                          <Upload size={12} />
                          {qrUrl ? "Replace" : "Upload QR"}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadQr(m.key, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account Details */}
          <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Account & Instructions</p>
              <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>These details are shown alongside the QR code on the deposit page</p>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <ConfigField
                label="Account Name"
                description="Name displayed to users (e.g. FireSlot Nepal)"
                value={drafts.deposit_account_name ?? ""}
                onChange={(v) => setDrafts(d => ({ ...d, deposit_account_name: v }))}
                onSave={() => save("deposit_account_name")}
                saving={savingKey === "deposit_account_name"}
                changed={(drafts.deposit_account_name ?? "") !== (items.find(i => i.key === "deposit_account_name")?.value ?? "")}
              />
              <ConfigField
                label="Account Number / ID"
                description="eSewa/Khalti number or bank account (copyable by users)"
                value={drafts.deposit_account_id ?? ""}
                onChange={(v) => setDrafts(d => ({ ...d, deposit_account_id: v }))}
                onSave={() => save("deposit_account_id")}
                saving={savingKey === "deposit_account_id"}
                changed={(drafts.deposit_account_id ?? "") !== (items.find(i => i.key === "deposit_account_id")?.value ?? "")}
              />
              <ConfigField
                label="Deposit Instructions"
                description="Guidance text shown in the amber box below the QR code"
                value={drafts.deposit_instructions ?? ""}
                onChange={(v) => setDrafts(d => ({ ...d, deposit_instructions: v }))}
                onSave={() => save("deposit_instructions")}
                saving={savingKey === "deposit_instructions"}
                changed={(drafts.deposit_instructions ?? "") !== (items.find(i => i.key === "deposit_instructions")?.value ?? "")}
                multiline
              />
            </div>
          </div>

          {/* Pricing & Expected Kills Control */}
          {pricingConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Pricing & Expected Kills Settings</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Configure platform service cuts, min/max allowable entry fees, and expected round-kills divisors.</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {pricingConfigs.map((config) => {
                  let desc = "Platform setting.";
                  if (config.key === "SYSTEM_FEE_PERCENT") desc = "Platform cut percentage taken from tournaments.";
                  else if (config.key === "CHALLENGE_FEE_PERCENT") desc = "Platform cut percentage taken from challenge matches.";
                  else if (config.key === "WITHDRAWAL_FEE_PERCENT") desc = "Platform withdrawal processing fee percentage.";
                  else if (config.key === "MAX_ENTRY_FEE") desc = "Maximum allowed entry fee (in NPR) for custom matches.";
                  else if (config.key === "MIN_ENTRY_FEE") desc = "Minimum allowed entry fee (in NPR) for paid matches.";
                  else if (config.key === "CS_EXPECTED_KILLS") desc = "Expected average kills per player in Clash Squad rounds (divides per-kill reward).";
                  else if (config.key === "LW_EXPECTED_KILLS") desc = "Expected average kills per player in Lone Wolf rounds (divides per-kill reward).";

                  return (
                    <ConfigField
                      key={config.key}
                      label={config.label}
                      description={desc}
                      value={sysDrafts[config.key] ?? ""}
                      onChange={(v) => setSysDrafts((d) => ({ ...d, [config.key]: v }))}
                      onSave={() => saveSys(config.key)}
                      saving={savingSysKey === config.key}
                      changed={(sysDrafts[config.key] ?? "") !== config.value}
                      type={config.type}
                      mono
                    />
                  );
                })}
              </div>
            </div>
          )}

          {walletLimitConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Wallet Limits</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Configure minimum allowed amounts for wallet deposits and withdrawals.</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {walletLimitConfigs.map((config) => (
                  <ConfigField
                    key={config.key}
                    label={config.label}
                    description={config.key === "MIN_DEPOSIT_AMOUNT_NPR"
                      ? "Users cannot submit wallet deposit requests below this amount."
                      : "Users cannot submit withdrawal requests below this amount."
                    }
                    value={sysDrafts[config.key] ?? ""}
                    onChange={(v) => setSysDrafts((d) => ({ ...d, [config.key]: v }))}
                    onSave={() => saveSys(config.key)}
                    saving={savingSysKey === config.key}
                    changed={(sysDrafts[config.key] ?? "") !== config.value}
                    type={config.type}
                    mono
                  />
                ))}
              </div>
            </div>
          )}

          {timingConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Tournament Timing</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Control how long rooms and live matches stay open before the system escalates them automatically.</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {timingConfigs.map((config) => (
                  <ConfigField
                    key={config.key}
                    label={config.label}
                    description={
                      config.key === "RESULT_SUBMIT_DELAY_MINS"
                        ? "How long players must wait after room sharing before result submission opens."
                        : config.key === "AUTO_START_MINS_BEFORE"
                        ? "Minutes after scheduled dateTime before auto-transitioning UPCOMING→LIVE (0=disabled). Room must be published."
                        : config.key === "PENDING_RESULTS_TO_COMPLETED_MINS"
                        ? "Minutes after entering PENDING_RESULTS before auto-completing (0=disabled). Only completes if all results are verified."
                        : "How long a LIVE tournament can stay active before it is moved to PENDING_RESULTS automatically."
                    }
                    value={sysDrafts[config.key] ?? ""}
                    onChange={(v) => setSysDrafts((d) => ({ ...d, [config.key]: v }))}
                    onSave={() => saveSys(config.key)}
                    saving={savingSysKey === config.key}
                    changed={(sysDrafts[config.key] ?? "") !== config.value}
                    type={config.type}
                    mono
                  />
                ))}
              </div>
            </div>
          )}

          {/* Auto Status Flow */}
          {autoFlowConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Auto Status Flow</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Enable automatic tournament status transitions. When enabled, tournaments will auto-progress: UPCOMING→LIVE (after scheduled time + delay), LIVE→PENDING_RESULTS (after timeout), PENDING_RESULTS→COMPLETED (after all results verified + delay).</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {autoFlowConfigs.map((config) => (
                  <ConfigField
                    key={config.key}
                    label={config.label}
                    description="Master switch for automatic tournament status transitions."
                    value={sysDrafts[config.key] ?? ""}
                    onChange={(v) => setSysDrafts((d) => ({ ...d, [config.key]: v }))}
                    onSave={() => saveSys(config.key)}
                    saving={savingSysKey === config.key}
                    changed={(sysDrafts[config.key] ?? "") !== config.value}
                    type={config.type}
                    mono
                  />
                ))}
              </div>
            </div>
          )}

          {/* App Update Settings */}
          {appUpdateConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>App Update Settings</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Configure app version requirements and update behavior for the in-app update checker.</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {appUpdateConfigs.map((config) => (
                  <ConfigField
                    key={config.key}
                    label={config.label}
                    description={
                      config.key === "APP_LATEST_VERSION"
                        ? "Latest available app version (e.g., 1.0.86-129a789). The app update checker will compare against this."
                        : config.key === "APP_MIN_ANDROID_VERSION"
                        ? "Minimum required Android app version. Users below this version will see a forced update prompt."
                        : config.key === "APP_FORCE_UPDATE_ENABLED"
                        ? "If enabled, users cannot dismiss the update prompt and must update to continue using the app."
                        : "If disabled, the in-app update checker will not offer downloads to users."
                    }
                    value={sysDrafts[config.key] ?? ""}
                    onChange={(v) => setSysDrafts((d) => ({ ...d, [config.key]: v }))}
                    onSave={() => saveSys(config.key)}
                    saving={savingSysKey === config.key}
                    changed={(sysDrafts[config.key] ?? "") !== config.value}
                    type={config.type}
                    mono
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Settings */}
          {otherConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>Other Settings</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {otherConfigs.map(c => (
                  <ConfigField
                    key={c.key}
                    label={c.key}
                    value={drafts[c.key] ?? ""}
                    onChange={(v) => setDrafts(d => ({ ...d, [c.key]: v }))}
                    onSave={() => save(c.key)}
                    saving={savingKey === c.key}
                    changed={(drafts[c.key] ?? "") !== c.value}
                    mono
                  />
                ))}
              </div>
            </div>
          )}

          {/* Remaining System Configs (grouped by category) */}
          {remainingSysConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>System Settings</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Other system-wide configuration values.</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {Object.entries(sysItems).map(([category, list]) => {
                  const visible = (list as any[]).filter((c) => !shownKeys.has(c.key));
                  if (!visible.length) return null;
                  return (
                    <div key={category}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fs-text-1)", marginBottom: 8 }}>{category}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {visible.map((config: any) => (
                          <ConfigField
                            key={config.key}
                            label={config.label ?? config.key}
                            value={sysDrafts[config.key] ?? ""}
                            onChange={(v) => setSysDrafts((d) => ({ ...d, [config.key]: v }))}
                            onSave={() => saveSys(config.key)}
                            saving={savingSysKey === config.key}
                            changed={(sysDrafts[config.key] ?? "") !== config.value}
                            type={config.type}
                            mono={config.type === "NUMBER" || config.type === "JSON"}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConfigField({ label, description, value, onChange, onSave, saving, changed, multiline, mono, type }: {
  label: string; description?: string; value: string; onChange: (v: string) => void;
  onSave: () => void; saving: boolean; changed: boolean; multiline?: boolean; mono?: boolean; type?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-text-1)", fontFamily: mono ? "monospace" : "inherit" }}>{label}</p>
          {description && <p style={{ fontSize: 11, color: "var(--fs-text-3)" }}>{description}</p>}
        </div>
        {changed && (
          <button onClick={onSave} disabled={saving} className="fs-btn fs-btn-primary fs-btn-sm" style={{ flexShrink: 0 }}>
            <ButtonLoading loading={saving} loadingText="..."><Save size={12} /> Save</ButtonLoading>
          </button>
        )}
      </div>
      {type === "BOOLEAN" ? (
        <select className="fs-input" value={value === "true" ? "true" : "false"} onChange={(e) => onChange(e.target.value)}>
          <option value="false">Disabled</option>
          <option value="true">Enabled</option>
        </select>
      ) : multiline ? (
        <textarea className="fs-input" style={{ height: 80, paddingTop: 12, resize: "vertical" }} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="fs-input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
