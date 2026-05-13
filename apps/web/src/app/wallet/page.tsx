"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { ButtonLoading, EmptyState, LoadingState, StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useFlags } from "@/lib/flags";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";
import { ArrowUpRight, Plus, Copy, Check, ChevronDown, ChevronUp, Gift } from "lucide-react";

export default function WalletPage() {
  const { user, loading } = useAuth();
  const { isEnabled } = useFlags();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [data, setData] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [form, setForm] = useState({ amountNpr: 100, method: "esewa" as const, account: "" });
  const [deposit, setDeposit] = useState({ amountNpr: 20, method: "esewa", reference: "" });
  const [proof, setProof] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function load() {
    setDataLoading(true);
    try {
      const [walletData, paymentRows, referralData] = await Promise.all([
        api("/wallet"),
        api("/payments/me"),
        api("/referrals/me").catch(() => null),
      ]);
      setData(walletData);
      setPayments(paymentRows);
      setReferral(referralData);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    api<Record<string, string>>("/app/config")
      .then(setPaymentConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTab(
      new URLSearchParams(window.location.search).get("tab") === "withdraw"
        ? "withdraw"
        : "deposit",
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user]);

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!form.method) { setMsg("Select a withdrawal method."); return; }
    if (!form.account || form.account.trim().length < 3) { setMsg("Enter a valid account detail."); return; }
    if (!Number.isFinite(Number(form.amountNpr)) || Number(form.amountNpr) < 1) {
      setMsg("Enter a valid withdrawal amount.");
      return;
    }
    setWithdrawing(true);
    try {
      await api("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ ...form, amountNpr: Number(form.amountNpr), account: form.account.trim() }),
      });
      setMsg("Withdrawal request submitted.");
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setWithdrawing(false); }
  }

  async function submitDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!proof) { setMsg("Upload payment proof screenshot."); return; }
    setDepositing(true);
    const fd = new FormData();
    fd.append("amountNpr", String(deposit.amountNpr));
    fd.append("method", deposit.method);
    fd.append("reference", deposit.reference);
    fd.append("proof", proof);
    try {
      await api("/payments/deposit", { method: "POST", body: fd });
      setMsg("Deposit submitted! We'll verify and credit your balance within 5-15 minutes.");
      setProof(null);
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setDepositing(false); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <LoadingState label="Loading wallet..." />;
  if (!user) return <div className="pt-6"><GoogleAuthPanel title="Sign in to use your wallet" /></div>;
  if (!data || dataLoading) return <LoadingState label="Loading wallet..." />;

  const qrImage = paymentConfig?.[`deposit_qr_${deposit.method}`] || paymentConfig?.deposit_qr_url || null;
  const paymentId = paymentConfig?.deposit_account_id || "";
  const paymentName = paymentConfig?.deposit_account_name || "FireSlot Nepal";
  const depositNote = paymentConfig?.deposit_instructions || "Send the exact amount to the account shown above. Then upload a screenshot of the payment confirmation.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Balance Card */}
      <div style={{ background: "var(--fs-surface-1)", borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--fs-border)" }}>
        <div style={{ height: 3, background: "linear-gradient(90deg, var(--fs-red), var(--fs-gold))" }} />
        <div style={{ padding: "24px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: "var(--fs-text-3)", textTransform: "uppercase" }}>Available Balance</p>
          <p style={{ fontSize: 40, fontWeight: 800, color: "var(--fs-text-1)", marginTop: 8 }}>
            {npr(data.wallet.balanceNpr)}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
            <button
              onClick={() => setTab("deposit")}
              className="fs-btn fs-btn-full"
              style={{ background: tab === "deposit" ? "var(--fs-red)" : "var(--fs-surface-2)", color: tab === "deposit" ? "#fff" : "var(--fs-text-2)", border: tab === "deposit" ? "none" : "1px solid var(--fs-border)" }}
            >
              <Plus size={16} /> Deposit
            </button>
            <button
              onClick={() => setTab("withdraw")}
              className="fs-btn fs-btn-full"
              style={{ background: tab === "withdraw" ? "var(--fs-red)" : "var(--fs-surface-2)", color: tab === "withdraw" ? "#fff" : "var(--fs-text-2)", border: tab === "withdraw" ? "none" : "1px solid var(--fs-border)" }}
            >
              <ArrowUpRight size={16} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {referral && (
        <Link
          href="/refer"
          className="block rounded-xl border p-4"
          style={{ background: "rgba(255,193,7,0.08)", borderColor: "rgba(255,193,7,0.22)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fs-gold)" }}>
                Refer & Earn
              </p>
              <p className="mt-1 text-sm font-bold" style={{ color: "var(--fs-text-1)" }}>
                Your code: <span className="font-mono tracking-[0.18em]">{referral.code}</span>
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--fs-text-3)" }}>
                Earn Rs {referral.referrerDepositRewardNpr} when a referred user makes their first deposit.
              </p>
            </div>
            <Gift size={22} style={{ color: "var(--fs-gold)" }} />
          </div>
        </Link>
      )}

      {tab === "deposit" ? (
        <form onSubmit={submitDeposit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Payment QR Section */}
          <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)", marginBottom: 16 }}>Step 1: Send Payment</p>

            {/* Method selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["esewa", "khalti", "bank"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDeposit({ ...deposit, method: m })}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: deposit.method === m ? "var(--fs-green-dim)" : "var(--fs-surface-2)",
                    border: deposit.method === m ? "1px solid var(--fs-green)" : "1px solid var(--fs-border)",
                    color: deposit.method === m ? "var(--fs-green)" : "var(--fs-text-3)",
                    cursor: "pointer", textTransform: "capitalize",
                  }}
                >
                  {m === "esewa" ? "eSewa" : m === "khalti" ? "Khalti" : "Bank"}
                </button>
              ))}
            </div>

            {/* QR Code Display */}
            {qrImage && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-block" }}>
                  <img
                    src={qrImage}
                    alt="Payment QR"
                    style={{ width: 180, height: 180, objectFit: "contain" }}
                  />
                </div>
                <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 8 }}>Scan to pay via {deposit.method}</p>
              </div>
            )}

            {/* Account Details */}
            <div style={{ background: "var(--fs-surface-2)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--fs-text-3)" }}>Account Name</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-text-1)" }}>{paymentName}</span>
              </div>
              {paymentId && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--fs-text-3)" }}>Account/ID</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-gold)", fontFamily: "monospace" }}>{paymentId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentId)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      {copied ? <Check size={14} style={{ color: "var(--fs-green)" }} /> : <Copy size={14} style={{ color: "var(--fs-text-3)" }} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--fs-amber-dim)", borderRadius: 8, borderLeft: "3px solid var(--fs-amber)" }}>
              <p style={{ fontSize: 12, color: "var(--fs-amber)", lineHeight: 1.5 }}>{depositNote}</p>
            </div>
          </div>

          {/* Step 2: Fill details */}
          <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)", marginBottom: 16 }}>Step 2: Submit Proof</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="fs-label">Amount (NPR)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="fs-input"
                  value={deposit.amountNpr}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setDeposit({ ...deposit, amountNpr: digits ? Number(digits) : 0 });
                  }}
                />
              </div>
              <div>
                <label className="fs-label">Transaction ID / Reference</label>
                <input
                  className="fs-input"
                  placeholder="e.g. TXN2024050912345"
                  value={deposit.reference}
                  onChange={(e) => setDeposit({ ...deposit, reference: e.target.value })}
                />
              </div>
              <div>
                <label className="fs-label">Payment Screenshot</label>
                <div
                  style={{
                    border: "2px dashed var(--fs-border-md)",
                    borderRadius: 10,
                    padding: "16px 12px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--fs-surface-2)",
                  }}
                  onClick={() => document.getElementById("proof-input")?.click()}
                >
                  {proof ? (
                    <p style={{ fontSize: 13, color: "var(--fs-green)" }}>{proof.name}</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: "var(--fs-text-2)" }}>Tap to upload screenshot</p>
                      <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 4 }}>PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
                <input
                  id="proof-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="fs-btn fs-btn-primary fs-btn-full"
              style={{ marginTop: 16, height: 48 }}
              disabled={depositing || !isEnabled("DEPOSIT_ENABLED")}
            >
              <ButtonLoading loading={depositing} loadingText="Submitting...">
                {isEnabled("DEPOSIT_ENABLED") ? "Submit Deposit Request" : "Deposits Disabled"}
              </ButtonLoading>
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={withdraw} style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)", marginBottom: 16 }}>Withdraw Funds</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="fs-label">Amount (NPR)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="fs-input"
                value={form.amountNpr}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, amountNpr: digits ? Number(digits) : 0 });
                }}
              />
            </div>
            <div>
              <label className="fs-label">Method</label>
              <select className="fs-input" value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as any })}>
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <label className="fs-label">Account Number / ID</label>
              <input className="fs-input" value={form.account} placeholder="Your eSewa/Khalti number or bank account"
                onChange={(e) => setForm({ ...form, account: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="fs-btn fs-btn-primary fs-btn-full" style={{ marginTop: 16, height: 48 }} disabled={withdrawing || !isEnabled("WITHDRAWAL_ENABLED")}>
            <ButtonLoading loading={withdrawing} loadingText="Processing...">
              {isEnabled("WITHDRAWAL_ENABLED") ? "Request Withdrawal" : "Withdrawals Disabled"}
            </ButtonLoading>
          </button>
          <p style={{ fontSize: 11, color: "var(--fs-text-3)", marginTop: 10, textAlign: "center" }}>
            Withdrawals are processed manually within 24 hours.
          </p>
        </form>
      )}

      {msg && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--fs-surface-2)", border: "0.5px solid var(--fs-border)" }}>
          <p style={{ fontSize: 13, color: "var(--fs-text-2)" }}>{msg}</p>
        </div>
      )}

      {/* Transaction History - Collapsible */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "14px 16px", borderRadius: 12,
          background: "var(--fs-surface-1)", border: "0.5px solid var(--fs-border)",
          cursor: "pointer", color: "var(--fs-text-1)", fontSize: 14, fontWeight: 600,
        }}
      >
        Transaction History
        {showHistory ? <ChevronUp size={16} style={{ color: "var(--fs-text-3)" }} /> : <ChevronDown size={16} style={{ color: "var(--fs-text-3)" }} />}
      </button>

      {showHistory && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", padding: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fs-text-1)", marginBottom: 12 }}>Deposits</p>
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <div>
                {payments.slice(0, 8).map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--fs-border)" }}>
                    <div>
                      <p style={{ fontSize: 13, color: "var(--fs-text-1)" }}>{p.tournament?.title ?? "Wallet deposit"}</p>
                      <p style={{ fontSize: 11, color: "var(--fs-text-3)" }}>{fmtDate(p.createdAt)}</p>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-text-1)" }}>{npr(p.amountNpr)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--fs-surface-1)", borderRadius: 14, border: "0.5px solid var(--fs-border)", padding: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fs-text-1)", marginBottom: 12 }}>Recent Transactions</p>
            {data.wallet.transactions.length === 0 ? (
              <EmptyState title="No transactions yet" />
            ) : (
              <div>
                {data.wallet.transactions.map((t: any) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--fs-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.type === "CREDIT" ? "var(--fs-green)" : "var(--fs-red)" }} />
                      <div>
                        <p style={{ fontSize: 13, color: "var(--fs-text-1)" }}>{t.reason}</p>
                        <p style={{ fontSize: 11, color: "var(--fs-text-3)" }}>{fmtDate(t.createdAt)}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.type === "CREDIT" ? "var(--fs-green)" : "var(--fs-red)" }}>
                      {t.type === "CREDIT" ? "+" : "-"}{npr(t.amountNpr)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
