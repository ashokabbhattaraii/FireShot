"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ButtonLoading, EmptyState, PageHeader, StatusBadge, TableLoading } from "@/components/ui";
import { npr } from "@/lib/utils";
import { UserAccessModal } from "@/components/admin/UserAccessModal";
import { Lock, RotateCcw, Search, Shield, Sliders, UserCog, Wallet } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: "PLAYER" | "ADMIN" | "FINANCE" | "SUPER_ADMIN";
  roleId: string | null;
  roleRef?: { id: string; name: string; isSystem: boolean } | null;
  isBanned: boolean;
  isLocked: boolean;
  sessionVersion: number;
  phone?: string | null;
  profile?: {
    ign?: string;
    freeFireUid?: string;
    level?: number;
    region?: string | null;
    avatarUrl?: string | null;
    headshotRate?: number | null;
    isEmulator?: boolean;
    isBlacklisted?: boolean;
    blacklistReason?: string | null;
  } | null;
  wallet?: { balanceNpr?: number } | null;
  _count?: { permissionOverrides: number };
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "border-neon-orange/50 bg-neon-orange/15 text-neon-orange",
  ADMIN: "border-neon/40 bg-neon/15 text-neon",
  MODERATOR: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  FINANCE: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
  SUPPORT: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  PLAYER: "border-border bg-surface text-white/60",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [banningId, setBanningId] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setUsers(await api("/admin/users"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function postUserAction(id: string, action: string) {
    setBanningId(id);
    try {
      await api(`/admin/users/${id}/${action}`, { method: "POST" });
      await load(false);
    } finally {
      setBanningId(null);
    }
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && (u.roleRef?.name ?? "") !== roleFilter) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        u.email.toLowerCase().includes(s) ||
        (u.name ?? "").toLowerCase().includes(s) ||
        (u.profile?.ign ?? "").toLowerCase().includes(s) ||
        (u.profile?.freeFireUid ?? "").toLowerCase().includes(s)
      );
    });
  }, [users, q, roleFilter]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { ALL: users.length, OVERRIDE: 0, BANNED: 0 };
    users.forEach((u) => {
      const k = u.roleRef?.name ?? "PLAYER";
      acc[k] = (acc[k] ?? 0) + 1;
      if ((u._count?.permissionOverrides ?? 0) > 0) acc.OVERRIDE += 1;
      if (u.isBanned) acc.BANNED += 1;
    });
    return acc;
  }, [users]);

  const roleOptions = Array.from(new Set(users.map((u) => u.roleRef?.name).filter(Boolean))) as string[];

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Users & Access"
        description="Assign roles, fine-tune individual permissions, and manage account access."
      />

      <div className="card mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[220px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="input pl-8"
              placeholder="Search by email, name, IGN, or FF UID"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="input w-44" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Pill label={`Total: ${counts.ALL ?? 0}`} />
          <Pill label={`With Overrides: ${counts.OVERRIDE ?? 0}`} tone="neon-orange" />
          <Pill label={`Banned: ${counts.BANNED ?? 0}`} tone="red" />
          {Object.keys(ROLE_COLORS).map((name) =>
            counts[name] ? <Pill key={name} label={`${name}: ${counts[name]}`} cls={ROLE_COLORS[name]} /> : null,
          )}
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableLoading columns={6} rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No users match your filter" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>IGN / FF UID</th>
                <th>Role</th>
                <th>Wallet</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const roleName = u.roleRef?.name ?? "—";
                const overrides = u._count?.permissionOverrides ?? 0;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {u.avatarUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-border" />
                        )}
                        <div>
                          <div className="text-white">{u.name ?? u.email}</div>
                          <div className="text-[10px] text-white/40">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-white/80">{u.profile?.ign ?? "—"}</div>
                      <div className="text-[10px] text-white/40 font-mono">{u.profile?.freeFireUid ?? "—"}</div>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            ROLE_COLORS[roleName] ?? ROLE_COLORS.PLAYER
                          }`}
                        >
                          <Shield size={10} /> {roleName}
                        </span>
                        {overrides > 0 && (
                          <span className="inline-flex items-center gap-1 rounded border border-neon-orange/50 bg-neon-orange/15 px-2 py-0.5 text-[10px] font-semibold text-neon-orange">
                            <Sliders size={10} /> OVERRIDE ×{overrides}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{npr(u.wallet?.balanceNpr ?? 0)}</td>
                    <td>
                      <StatusBadge status={u.isBanned ? "BANNED" : "ACTIVE"} />
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button onClick={() => setEditing(u.id)} className="btn-outline text-xs">
                          Manage Access
                        </button>
                        <button onClick={() => setProfileId(u.id)} className="btn-outline text-xs">
                          <UserCog size={12} /> Profile
                        </button>
                        {roleName !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => postUserAction(u.id, u.isBanned ? "unban" : "ban")}
                            className="btn-outline text-xs"
                            disabled={banningId === u.id}
                          >
                            <ButtonLoading loading={banningId === u.id} loadingText="Saving...">
                              {u.isBanned ? "Unban" : "Ban"}
                            </ButtonLoading>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <UserAccessModal userId={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
      {profileId && (
        <UserControlDrawer
          userId={profileId}
          onClose={() => setProfileId(null)}
          onSaved={() => load(false)}
          onAction={postUserAction}
          busyId={banningId}
        />
      )}
    </div>
  );
}

function Pill({ label, tone, cls }: { label: string; tone?: string; cls?: string }) {
  const base =
    cls ??
    (tone === "red"
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : tone === "neon-orange"
        ? "border-neon-orange/40 bg-neon-orange/10 text-neon-orange"
        : "border-border bg-surface text-white/70");
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${base}`}>
      {label}
    </span>
  );
}

function UserControlDrawer({
  userId,
  onClose,
  onSaved,
  onAction,
  busyId,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  onAction: (id: string, action: string) => Promise<void>;
  busyId: string | null;
}) {
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>({});
  const [adjust, setAdjust] = useState({ amountNpr: "", actionType: "ADMIN_ADJUSTMENT", comment: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const detail = await api<any>(`/admin/users/${userId}`);
      setData(detail);
      const u = detail.user;
      setProfile({
        name: u.name ?? "",
        phone: u.phone ?? "",
        avatarUrl: u.avatarUrl ?? "",
        ign: u.profile?.ign ?? "",
        freeFireUid: u.profile?.freeFireUid ?? "",
        level: String(u.profile?.level ?? 1),
        region: u.profile?.region ?? "",
        headshotRate: u.profile?.headshotRate == null ? "" : String(u.profile.headshotRate),
        isEmulator: Boolean(u.profile?.isEmulator),
        isBlacklisted: Boolean(u.profile?.isBlacklisted),
        blacklistReason: u.profile?.blacklistReason ?? "",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [userId]);

  async function saveProfile() {
    setSaving(true);
    setMsg(null);
    try {
      await api(`/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone || null,
          avatarUrl: profile.avatarUrl || null,
          profile: {
            ign: profile.ign,
            freeFireUid: profile.freeFireUid,
            level: Number(profile.level || 1),
            region: profile.region || null,
            headshotRate: profile.headshotRate === "" ? null : Number(profile.headshotRate),
            isEmulator: profile.isEmulator,
            isBlacklisted: profile.isBlacklisted,
            blacklistReason: profile.blacklistReason || null,
          },
        }),
      });
      setMsg("Profile saved");
      await load();
      onSaved();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitAdjustment() {
    const amount = Number(adjust.amountNpr);
    if (!Number.isFinite(amount) || amount === 0) {
      setMsg("Enter a non-zero amount");
      return;
    }
    if (adjust.comment.trim().length < 10) {
      setMsg("Comment must be at least 10 characters");
      return;
    }
    const large = Math.abs(amount) >= 10_000;
    if (large && !confirm("Large wallet adjustment. Confirm one more time?")) return;
    setAdjusting(true);
    setMsg(null);
    try {
      await api(`/admin/users/${userId}/balance-adjustments`, {
        method: "POST",
        body: JSON.stringify({
          amountNpr: amount,
          actionType: adjust.actionType,
          comment: adjust.comment,
          confirmLargeAdjustment: large,
        }),
      });
      setAdjust({ amountNpr: "", actionType: "ADMIN_ADJUSTMENT", comment: "" });
      setMsg("Balance adjusted and user notified");
      await load();
      onSaved();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setAdjusting(false);
    }
  }

  const u = data?.user;
  const roleName = u?.roleRef?.name ?? u?.role;

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col overflow-y-auto border-l border-border bg-[var(--fs-surface-1)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-[var(--fs-surface-1)] p-4">
          <div>
            <p className="label">Account Control</p>
            <h2 className="font-display text-xl text-white">{u?.name ?? u?.email ?? "Loading..."}</h2>
            {u && <p className="text-xs text-white/50">{u.email} · {roleName}</p>}
          </div>
          <button className="btn-outline" onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <div className="p-4"><TableLoading columns={2} rows={5} /></div>
        ) : !u ? (
          <div className="p-4 text-red-400">{msg ?? "Unable to load user"}</div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[1.25fr_.9fr]">
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base text-white">Profile Details</h3>
                <StatusBadge status={u.isLocked ? "LOCKED" : u.isBanned ? "BANNED" : "ACTIVE"} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                <Field label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                <Field label="Avatar URL" value={profile.avatarUrl} onChange={(v) => setProfile({ ...profile, avatarUrl: v })} />
                <Field label="IGN" value={profile.ign} onChange={(v) => setProfile({ ...profile, ign: v })} />
                <Field label="Free Fire UID" value={profile.freeFireUid} onChange={(v) => setProfile({ ...profile, freeFireUid: v })} />
                <Field label="Level" value={profile.level} onChange={(v) => setProfile({ ...profile, level: v.replace(/\D/g, "") })} />
                <Field label="Region" value={profile.region} onChange={(v) => setProfile({ ...profile, region: v })} />
                <Field label="Headshot Rate" value={profile.headshotRate} onChange={(v) => setProfile({ ...profile, headshotRate: v })} />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm text-white/80">
                  <input type="checkbox" checked={profile.isEmulator} onChange={(e) => setProfile({ ...profile, isEmulator: e.target.checked })} />
                  Emulator player
                </label>
                <label className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm text-white/80">
                  <input type="checkbox" checked={profile.isBlacklisted} onChange={(e) => setProfile({ ...profile, isBlacklisted: e.target.checked })} />
                  Blacklisted
                </label>
              </div>
              <label className="mt-3 block">
                <span className="label">Blacklist reason</span>
                <textarea className="input" rows={3} value={profile.blacklistReason} onChange={(e) => setProfile({ ...profile, blacklistReason: e.target.value })} />
              </label>
              <button className="btn-primary mt-3" onClick={saveProfile} disabled={saving}>
                <ButtonLoading loading={saving} loadingText="Saving...">Save Profile</ButtonLoading>
              </button>
            </section>

            <aside className="space-y-4">
              <section className="card">
                <h3 className="font-display text-base text-white">Super Controls</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-outline text-xs" disabled={busyId === userId || roleName === "SUPER_ADMIN"} onClick={() => onAction(userId, u.isBanned ? "unban" : "ban")}>
                    <Shield size={12} /> {u.isBanned ? "Unsuspend" : "Suspend"}
                  </button>
                  <button className="btn-outline text-xs" disabled={busyId === userId || roleName === "SUPER_ADMIN"} onClick={() => onAction(userId, u.isLocked ? "unlock" : "lock")}>
                    <Lock size={12} /> {u.isLocked ? "Unlock" : "Lock"}
                  </button>
                  <button className="btn-outline col-span-2 text-xs" disabled={busyId === userId} onClick={() => onAction(userId, "reset-sessions")}>
                    <RotateCcw size={12} /> Force Logout All Sessions
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-white/45">Sensitive actions are permission-gated and written to the audit log.</p>
              </section>

              <section className="card">
                <h3 className="font-display text-base text-white flex items-center gap-2"><Wallet size={16} /> Balance</h3>
                <p className="mt-2 text-2xl font-bold text-neon">{npr(u.wallet?.balanceNpr ?? 0)}</p>
                <div className="mt-3 grid gap-2">
                  <select className="input" value={adjust.actionType} onChange={(e) => setAdjust({ ...adjust, actionType: e.target.value })}>
                    <option value="ADMIN_ADJUSTMENT">Admin adjustment</option>
                    <option value="PAYMENT_CORRECTION">Payment correction</option>
                    <option value="REFUND">Refund</option>
                    <option value="PENALTY">Penalty</option>
                  </select>
                  <input className="input" inputMode="numeric" placeholder="+100 or -100" value={adjust.amountNpr} onChange={(e) => setAdjust({ ...adjust, amountNpr: e.target.value })} />
                  <textarea className="input" rows={3} placeholder="Required user-visible comment" value={adjust.comment} onChange={(e) => setAdjust({ ...adjust, comment: e.target.value })} />
                  <button className="btn-primary" onClick={submitAdjustment} disabled={adjusting}>
                    <ButtonLoading loading={adjusting} loadingText="Adjusting...">Apply Adjustment</ButtonLoading>
                  </button>
                </div>
              </section>
              {msg && <p className="rounded border border-border bg-surface p-2 text-xs text-white/70">{msg}</p>}
            </aside>

            <section className="card lg:col-span-2">
              <h3 className="font-display text-base text-white">Recent Audit & Balance History</h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <History title="Balance Adjustments" items={u.balanceAdjustmentsReceived ?? []} />
                <History title="Admin Actions" items={data.audit ?? []} actionLog />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function History({ title, items, actionLog }: { title: string; items: any[]; actionLog?: boolean }) {
  return (
    <div className="overflow-hidden rounded border border-border">
      <div className="border-b border-border bg-surface px-3 py-2 text-xs font-semibold text-white/80">{title}</div>
      <div className="max-h-80 overflow-auto">
        {items.length === 0 ? (
          <p className="p-3 text-xs text-white/45">No entries yet</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="border-b border-border/50 px-3 py-2 text-xs last:border-0">
              <div className="flex justify-between gap-2">
                <span className="font-mono text-neon-cyan">{actionLog ? item.action : item.actionType}</span>
                <span className="text-white/45">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-white/70">
                {actionLog
                  ? `${item.admin?.email ?? "admin"} changed ${item.resource}`
                  : `${item.amountNpr > 0 ? "+" : ""}${npr(item.amountNpr)} · ${item.comment}`}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
