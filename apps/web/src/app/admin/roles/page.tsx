"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ButtonLoading, CardSkeleton } from "@/components/ui";

interface Permission { id?: string; resource: string; action: string }
interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Permission[];
  permissionCount: number;
  userCount: number;
}

const RESOURCES = ["tournaments", "payments", "users", "withdrawals", "results", "config", "support", "challenges", "referrals", "roles", "logs", "bot", "banners", "apk", "*"];
const ACTIONS = ["read", "write", "approve", "adjust", "delete", "ban", "lock", "session", "toggle", "*"];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      setRoles(await api<Role[]>("/admin/roles"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  function startEdit(r: Role) {
    setEditing(r.id);
    setEditPerms(r.permissions.map(({ resource, action }) => ({ resource, action })));
  }
  function togglePerm(resource: string, action: string) {
    const has = editPerms.some((p) => p.resource === resource && p.action === action);
    setEditPerms(has
      ? editPerms.filter((p) => !(p.resource === resource && p.action === action))
      : [...editPerms, { resource, action }]
    );
  }
  async function savePerms(id: string) {
    setSavingId(id);
    try {
      await api(`/admin/roles/${id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: editPerms }),
      });
      setEditing(null);
      await load(false);
    } catch (e: any) { setMsg(e.message); }
    finally { setSavingId(null); }
  }
  async function createRole() {
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      await api("/admin/roles", { method: "POST", body: JSON.stringify({ name: newRoleName, permissions: [] }) });
      setNewRoleName("");
      await load(false);
    } catch (e: any) { setMsg(e.message); }
    finally { setCreating(false); }
  }
  async function deleteRole(id: string) {
    if (!confirm("Delete role?")) return;
    setDeletingId(id);
    try {
      await api(`/admin/roles/${id}`, { method: "DELETE" });
      await load(false);
    } catch (e: any) { setMsg(e.message); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Roles & Permissions</h1>
        {msg && <span className="text-xs text-white/70">{msg}</span>}
      </div>

      <div className="card flex gap-3 items-end">
        <div className="flex-1">
          <label className="label">New Role Name</label>
          <input className="input" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={createRole} disabled={creating}>
          <ButtonLoading loading={creating} loadingText="Creating...">
            Create
          </ButtonLoading>
        </button>
      </div>

      {loading ? (
        <>
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </>
      ) : roles.map((r) => (
        <div key={r.id} className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-white">
                {r.name}
                {r.isSystem && <span className="ml-2 text-xs text-neon-cyan">SYSTEM</span>}
              </h2>
              <div className="text-xs text-white/50">{r.permissionCount} permissions • {r.userCount} users</div>
            </div>
            <div className="flex gap-2">
              {editing === r.id ? (
                <>
                  <button className="btn-primary" onClick={() => savePerms(r.id)} disabled={savingId === r.id}>
                    <ButtonLoading loading={savingId === r.id} loadingText="Saving...">
                      Save
                    </ButtonLoading>
                  </button>
                  <button className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <button className="btn-outline" onClick={() => startEdit(r)}>Edit Permissions</button>
              )}
              {!r.isSystem && (
                <button
                  className="btn-outline text-red-400"
                  onClick={() => deleteRole(r.id)}
                  disabled={deletingId === r.id}
                >
                  <ButtonLoading loading={deletingId === r.id} loadingText="Deleting...">
                    Delete
                  </ButtonLoading>
                </button>
              )}
            </div>
          </div>

          {editing === r.id ? (
            <table className="mt-4 w-full text-xs">
              <thead>
                <tr className="text-white/50">
                  <th className="text-left p-1">resource \\ action</th>
                  {ACTIONS.map((a) => <th key={a} className="p-1">{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((res) => (
                  <tr key={res} className="border-t border-border">
                    <td className="p-1 text-white/80 font-mono">{res}</td>
                    {ACTIONS.map((a) => {
                      const has = editPerms.some((p) => p.resource === res && p.action === a);
                      return (
                        <td key={a} className="p-1 text-center">
                          <input type="checkbox" checked={has} onChange={() => togglePerm(res, a)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1">
              {r.permissions.length === 0 && <span className="text-xs text-white/40">No permissions</span>}
              {r.permissions.map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-surface text-neon-cyan font-mono">
                  {p.resource}:{p.action}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Assign Role to User */}
      <div className="card mt-6">
        <h2 className="font-display text-lg text-white mb-3">Assign Role to User</h2>
        <p className="text-xs text-white/50 mb-4">Search user by email and assign a role</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1" style={{ minWidth: 200 }}>
            <label className="label">User Email</label>
            <input
              className="input"
              placeholder="user@email.com"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <label className="label">Role</label>
            <select
              className="input"
              value={assignRoleId}
              onChange={(e) => setAssignRoleId(e.target.value)}
            >
              <option value="">Select role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary"
            disabled={assigning || !assignEmail || !assignRoleId}
            onClick={async () => {
              setAssigning(true);
              setAssignResult(null);
              try {
                const users = await api<any[]>("/admin/users");
                const found = users.find((u: any) => u.email.toLowerCase() === assignEmail.toLowerCase());
                if (!found) {
                  setAssignResult("User not found with that email");
                  return;
                }
                await api(`/admin/users/${found.id}/role`, {
                  method: "PUT",
                  body: JSON.stringify({ roleId: assignRoleId }),
                });
                const roleName = roles.find((r) => r.id === assignRoleId)?.name;
                setAssignResult(`Assigned ${roleName} to ${found.email}`);
                setAssignEmail("");
                await load(false);
              } catch (e: any) {
                setAssignResult(e.message ?? "Failed");
              } finally {
                setAssigning(false);
              }
            }}
          >
            <ButtonLoading loading={assigning} loadingText="Assigning...">
              Assign Role
            </ButtonLoading>
          </button>
        </div>
        {assignResult && (
          <p className="text-xs mt-3" style={{ color: assignResult.includes("Assigned") ? "var(--fs-green)" : "var(--fs-red)" }}>
            {assignResult}
          </p>
        )}
        {assignRoleId && roles.find((r) => r.id === assignRoleId && (r.name === "ADMIN" || r.name === "SUPER_ADMIN")) && (
          <p className="text-xs mt-2 px-3 py-2 rounded" style={{ background: "rgba(229,57,53,0.1)", color: "var(--fs-amber)" }}>
            Assigning {roles.find((r) => r.id === assignRoleId)?.name} gives significant platform access
          </p>
        )}
      </div>
    </div>
  );
}
