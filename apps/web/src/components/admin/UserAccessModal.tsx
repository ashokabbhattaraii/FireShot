"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { X, ShieldCheck, ShieldX, Minus } from "lucide-react";
import { ButtonLoading, LoadingState } from "@/components/ui";

const RESOURCES = ["tournaments", "payments", "users", "withdrawals", "results", "config", "support", "challenges", "referrals", "*"];
const ACTIONS = ["read", "write", "approve", "delete", "ban", "*"];

type Effect = "ALLOW" | "DENY" | "INHERIT";
interface Permission { resource: string; action: string }
interface Role { id: string; name: string; isSystem: boolean; permissions: Permission[] }
interface Override { resource: string; action: string; effect: "ALLOW" | "DENY" }
interface AccessData {
  user: {
    id: string; email: string; name: string | null;
    roleId: string | null; roleName: string | null;
    rolePermissions: Permission[];
    overrides: Override[];
  };
  availableRoles: Role[];
}

export function UserAccessModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<AccessData | null>(null);
  const [roleId, setRoleId] = useState<string>("");
  const [matrix, setMatrix] = useState<Record<string, Effect>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<AccessData>(`/admin/users/${userId}/access`).then((d) => {
      setData(d);
      setRoleId(d.user.roleId ?? "");
      const m: Record<string, Effect> = {};
      d.user.overrides.forEach((o) => { m[`${o.resource}:${o.action}`] = o.effect; });
      setMatrix(m);
    }).catch((e) => setErr(e.message));
  }, [userId]);

  const selectedRole = data?.availableRoles.find((r) => r.id === roleId);
  const rolePerms = selectedRole?.permissions ?? data?.user.rolePermissions ?? [];

  function roleAllows(resource: string, action: string) {
    return rolePerms.some(
      (p) =>
        (p.resource === resource || p.resource === "*") &&
        (p.action === action || p.action === "*"),
    );
  }

  function cycle(resource: string, action: string) {
    const key = `${resource}:${action}`;
    const cur = matrix[key];
    const next: Effect = cur === undefined ? "ALLOW" : cur === "ALLOW" ? "DENY" : "INHERIT";
    setMatrix((m) => {
      const copy = { ...m };
      if (next === "INHERIT") delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const overrides: Override[] = Object.entries(matrix)
        .filter(([, v]) => v === "ALLOW" || v === "DENY")
        .map(([k, v]) => {
          const [resource, action] = k.split(":");
          return { resource, action, effect: v as "ALLOW" | "DENY" };
        });
      await api(`/admin/users/${userId}/access`, {
        method: "PUT",
        body: JSON.stringify({ roleId: roleId || undefined, overrides }),
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="card relative w-full max-w-4xl my-8">
        <button className="absolute right-3 top-3 text-white/60 hover:text-white" onClick={onClose}>
          <X size={18} />
        </button>
        {!data ? (
          <LoadingState label="Loading access settings..." />
        ) : (
          <>
            <h2 className="font-display text-xl text-white">Manage Access</h2>
            <p className="text-sm text-white/60">{data.user.email}</p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Role</label>
                <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">— No Role —</option>
                  {data.availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isSystem ? "(system)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-white/50">
                  Role grants base permissions. Per-user overrides below take priority — use them to grant or revoke single capabilities without changing the role.
                </p>
              </div>

              <div className="rounded-md border border-border p-3 text-xs space-y-1">
                <p className="text-white/70 font-semibold">Legend</p>
                <p className="flex items-center gap-2 text-neon-green"><ShieldCheck size={12} /> ALLOW — explicit grant</p>
                <p className="flex items-center gap-2 text-red-400"><ShieldX size={12} /> DENY — explicit block</p>
                <p className="flex items-center gap-2 text-white/50"><Minus size={12} /> INHERIT — use role default</p>
                <p className="text-white/50">Click a cell to cycle ALLOW → DENY → INHERIT.</p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/50">
                    <th className="text-left p-2">Resource \\ Action</th>
                    {ACTIONS.map((a) => <th key={a} className="p-2">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((res) => (
                    <tr key={res} className="border-t border-border">
                      <td className="p-2 text-white/80 font-mono">{res}</td>
                      {ACTIONS.map((a) => {
                        const key = `${res}:${a}`;
                        const eff = matrix[key];
                        const inherited = roleAllows(res, a);
                        const display: Effect = eff ?? "INHERIT";
                        const cls =
                          display === "ALLOW"
                            ? "bg-neon-green/20 text-neon-green border-neon-green/40"
                            : display === "DENY"
                              ? "bg-red-500/20 text-red-400 border-red-500/40"
                              : inherited
                                ? "bg-neon/10 text-neon border-neon/30"
                                : "bg-surface text-white/40 border-border";
                        const label =
                          display === "ALLOW" ? "ALLOW" : display === "DENY" ? "DENY" : inherited ? "✓ role" : "—";
                        return (
                          <td key={a} className="p-1 text-center">
                            <button
                              onClick={() => cycle(res, a)}
                              className={`w-full rounded border px-2 py-1 text-[10px] font-semibold ${cls}`}
                            >
                              {label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                <ButtonLoading loading={saving} loadingText="Saving access...">
                  Save Access
                </ButtonLoading>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
