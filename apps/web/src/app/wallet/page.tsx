"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtDate, npr } from "@/lib/utils";
import { ButtonLoading, EmptyState, LoadingState, StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useFlags } from "@/lib/flags";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";
import { ArrowUpRight, Plus, Copy, Check, ChevronDown, ChevronUp, Gift, Wallet, ArrowDownLeft, FileText, Landmark } from "lucide-react";

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
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#1c1233] via-[#0f0a26] to-[#1c1233] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.06),transparent_35%)]" />
        <div className="h-[3px] bg-gradient-to-r from-[#E53935] via-[#FFD700] to-[#E53935]" />
        <div className="relative z-10 px-5 py-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
            <Wallet className="text-[#FFD700]" size={18} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Available Balance</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {npr(data.wallet.balanceNpr)}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setTab("deposit")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl h-11 text-xs font-bold transition-all duration-200 ${
                tab === "deposit"
                  ? "bg-[#E53935] text-white shadow-[0_4px_16px_rgba(229,57,53,0.3)]"
                  : "bg-white/5 text-white/70 border border-white/5 hover:bg-white/10"
              }`}
            >
              <Plus size={14} /> Deposit
            </button>
            <button
              onClick={() => setTab("withdraw")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl h-11 text-xs font-bold transition-all duration-200 ${
                tab === "withdraw"
                  ? "bg-[#E53935] text-white shadow-[0_4px_16px_rgba(229,57,53,0.3)]"
                  : "bg-white/5 text-white/70 border border-white/5 hover:bg-white/10"
              }`}
            >
              <ArrowUpRight size={14} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {referral && (
        <Link
          href="/refer"
          className="block rounded-2xl border border-yellow-500/10 bg-gradient-to-br from-yellow-500/[0.04] to-amber-500/[0.02] p-4 transition-all duration-200 hover:border-yellow-500/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#FFD700]">
                Refer & Earn Bonus
              </p>
              <p className="mt-1 text-sm font-bold text-white flex items-center gap-1.5">
                Your code: <span className="font-mono tracking-[0.15em] bg-yellow-500/10 px-2 py-0.5 rounded text-[#FFD700] text-xs">{referral.code}</span>
              </p>
              <p className="mt-1 text-xs text-white/60">
                Earn Rs {referral.referrerDepositRewardNpr} when friends make their first deposit.
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10">
              <Gift size={18} className="text-[#FFD700]" />
            </div>
          </div>
        </Link>
      )}

      {tab === "deposit" ? (
        <form onSubmit={submitDeposit} className="space-y-4">
          {/* Payment QR Section */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-5">
            <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E53935] text-[10px] text-white font-bold">1</span>
              Send Payment
            </p>

            {/* Method selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["esewa", "khalti", "bank"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDeposit({ ...deposit, method: m })}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 border text-center capitalize ${
                    deposit.method === m
                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                      : "bg-[#16162a] border-white/5 text-white/50 hover:bg-[#1e1e38] hover:text-white"
                  }`}
                >
                  {m === "esewa" ? "eSewa" : m === "khalti" ? "Khalti" : "Bank Transfer"}
                </button>
              ))}
            </div>

            {/* QR Code Display */}
            {qrImage && (
              <div className="text-center mb-4">
                <div className="inline-block bg-white p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  <img
                    src={qrImage}
                    alt="Payment QR"
                    className="w-44 h-44 object-contain mx-auto"
                  />
                </div>
                <p className="text-[10px] text-white/40 mt-2 font-medium">Scan QR to pay via {deposit.method === "esewa" ? "eSewa" : deposit.method === "khalti" ? "Khalti" : "Banking app"}</p>
              </div>
            )}

            {/* Account Details */}
            <div className="rounded-xl bg-[#16162a] border border-white/5 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/40">Account Name</span>
                <span className="font-bold text-white">{paymentName}</span>
              </div>
              {paymentId && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Account / ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#FFD700] tracking-wider">{paymentId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentId)}
                      className="p-1 text-white/40 hover:text-white transition-colors"
                      title="Copy account details"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-4 p-3 bg-amber-500/[0.06] rounded-xl border-l-[3px] border-amber-500 text-xs">
              <p className="text-amber-200/90 leading-relaxed font-medium">{depositNote}</p>
            </div>
          </div>

          {/* Step 2: Fill details */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-5">
            <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E53935] text-[10px] text-white font-bold">2</span>
              Submit Proof
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="fs-label">Amount (NPR)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input"
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
                  className="input"
                  placeholder="e.g. TXN2026050912345"
                  value={deposit.reference}
                  onChange={(e) => setDeposit({ ...deposit, reference: e.target.value })}
                />
              </div>
              <div>
                <label className="fs-label">Payment Screenshot</label>
                <div
                  className="border-2 border-dashed border-white/10 rounded-xl p-5 text-center cursor-pointer bg-[#16162a] hover:bg-white/[0.02] transition-colors"
                  onClick={() => document.getElementById("proof-input")?.click()}
                >
                  {proof ? (
                    <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <FileText size={16} />
                      {proof.name}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white/70">Tap to select or upload screenshot</p>
                      <p className="text-[10px] text-white/40">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="proof-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="fs-btn fs-btn-primary fs-btn-full mt-5 rounded-xl text-xs h-11"
              disabled={depositing || !isEnabled("DEPOSIT_ENABLED")}
            >
              <ButtonLoading loading={depositing} loadingText="Submitting details...">
                {isEnabled("DEPOSIT_ENABLED") ? "Submit Deposit Request" : "Deposits Disabled"}
              </ButtonLoading>
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={withdraw} className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-5">
          <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E53935] text-[10px] text-white font-bold">1</span>
            Withdraw Funds
          </p>

          <div className="space-y-3.5">
            <div>
              <label className="fs-label">Amount (NPR)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input"
                value={form.amountNpr}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, amountNpr: digits ? Number(digits) : 0 });
                }}
              />
            </div>
            <div>
              <label className="fs-label">Method</label>
              <select
                className="input cursor-pointer"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as any })}
              >
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="fs-label">Account Number / ID</label>
              <input
                className="input"
                value={form.account}
                placeholder="eSewa/Khalti phone number or bank account detail"
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="fs-btn fs-btn-primary fs-btn-full mt-5 rounded-xl text-xs h-11"
            disabled={withdrawing || !isEnabled("WITHDRAWAL_ENABLED")}
          >
            <ButtonLoading loading={withdrawing} loadingText="Processing Request...">
              {isEnabled("WITHDRAWAL_ENABLED") ? "Submit Withdrawal Request" : "Withdrawals Disabled"}
            </ButtonLoading>
          </button>
          <p className="text-[10px] text-white/40 mt-3 text-center">
            * Withdrawal requests are verified and credited within 24 hours.
          </p>
        </form>
      )}

      {msg && (
        <div className="rounded-xl border border-white/5 bg-[#16162a] p-3 text-center">
          <p className="text-xs text-white/80 font-semibold">{msg}</p>
        </div>
      )}

      {/* Transaction History - Collapsible */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-white/5 bg-[#13132a] text-xs font-bold text-white hover:bg-white/[0.01] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Landmark size={14} className="text-white/60" />
          Transaction History
        </span>
        {showHistory ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {showHistory && (
        <div className="space-y-3.5">
          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-4">
            <p className="text-xs font-bold text-white mb-3 flex items-center gap-1">
              <ArrowDownLeft size={14} className="text-emerald-400" />
              Recent Deposits
            </p>
            {payments.length === 0 ? (
              <EmptyState title="No deposits yet" />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {payments.slice(0, 8).map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{p.tournament?.title ?? "Wallet deposit"}</p>
                      <p className="text-[10px] text-white/40">{fmtDate(p.createdAt)}</p>
                    </div>
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-white">{npr(p.amountNpr)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#13132a] to-[#0f0f1f] p-4">
            <p className="text-xs font-bold text-white mb-3 flex items-center gap-1">
              <ArrowUpRight size={14} className="text-[#E53935]" />
              Account Ledger
            </p>
            {data.wallet.transactions.length === 0 ? (
              <EmptyState title="No ledger records" />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {data.wallet.transactions.map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.type === "CREDIT" ? "bg-emerald-400" : "bg-[#E53935]"}`} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{t.reason}</p>
                        <p className="text-[10px] text-white/40">{fmtDate(t.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${t.type === "CREDIT" ? "text-emerald-400" : "text-[#E53935]"}`}>
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
