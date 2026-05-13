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

const FEE_KEYS = ["SYSTEM_FEE_PERCENT", "CHALLENGE_FEE_PERCENT", "WITHDRAWAL_FEE_PERCENT"];
const WALLET_LIMIT_KEYS = ["MIN_DEPOSIT_AMOUNT_NPR", "MIN_WITHDRAWAL_AMOUNT_NPR"];
const APP_UPDATE_KEYS = ["APP_LATEST_VERSION", "APP_MIN_ANDROID_VERSION", "APP_FORCE_UPDATE_ENABLED", "APP_DOWNLOAD_ENABLED"];

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
  const feeConfigs = flatSysItems.filter((config) => FEE_KEYS.includes(config.key));
  const walletLimitConfigs = flatSysItems.filter((config) => WALLET_LIMIT_KEYS.includes(config.key));
  const appUpdateConfigs = flatSysItems.filter((config) => APP_UPDATE_KEYS.includes(config.key));

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

          {/* System Fee Settings */}
          {feeConfigs.length > 0 && (
            <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--fs-border)", background: "var(--fs-surface-2)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>System Fee Settings</p>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 2 }}>Configure the platform service cuts for tournaments, challenges, and withdrawals.</p>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {feeConfigs.map((config) => (
                  <ConfigField
                    key={config.key}
                    label={config.label}
                    description={config.key === "WITHDRAWAL_FEE_PERCENT" ? "Withdrawal fee is deducted from the requested amount." : "Percent of entry fee collected by the platform."}
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
