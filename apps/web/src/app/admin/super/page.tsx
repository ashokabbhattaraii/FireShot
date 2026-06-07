"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Database, Download, Search, Table, User, ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

interface TableInfo { name: string; rowCount: number; }

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<any>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"tables" | "users" | "backup">("tables");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) return;
    api("/super-admin/tables").then(setTables).catch(() => {});
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || tab !== "users") return;
    loadUsers(usersPage);
  }, [isSuperAdmin, tab, usersPage]);

  async function loadUsers(p: number) {
    setLoading(true);
    try {
      const data = await api(`/super-admin/users?page=${p}&limit=25`);
      setUsers(data);
    } catch {}
    setLoading(false);
  }

  async function expandUser(userId: string) {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    setUserDetail(null);
    try {
      const data = await api(`/super-admin/users/${userId}/full`);
      setUserDetail(data);
    } catch {}
  }

  async function browseTable(table: string, p = 1) {
    setLoading(true);
    setSelectedTable(table);
    setPage(p);
    try {
      const data = await api(`/super-admin/tables/${table}?page=${p}&limit=25`);
      setTableData(data);
    } catch {}
    setLoading(false);
  }

  function downloadBackup() {
    const token = localStorage.getItem("fs_token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/backup`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `db-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    });
  }

  function downloadTable(table: string) {
    const token = localStorage.getItem("fs_token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/export/${table}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${table}-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    });
  }

  function exportUsersJSON() {
    const token = localStorage.getItem("fs_token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/export/User`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `users-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    });
  }

  function exportUsersExcel() {
    if (!users?.users?.length) return;
    const rows = users.users.map((u: any) => ({
      ID: u.id,
      Name: u.name ?? "",
      Email: u.email,
      Role: u.role,
      "FF UID": u.profile?.freeFireUid ?? "",
      IGN: u.profile?.ign ?? "",
      Balance: u.wallet?.balanceNpr ?? 0,
      Payments: u._count?.payments ?? 0,
      Tournaments: u._count?.tournaments ?? 0,
      Withdrawals: u._count?.withdrawals ?? 0,
      Banned: u.isBanned ? "Yes" : "No",
      Created: new Date(u.createdAt).toISOString(),
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((r: any) => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `users-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function handleRestore() {
    if (!restoreFile) return;
    if (!confirm("⚠️ This will OVERWRITE existing data with the backup. Are you absolutely sure?")) return;
    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const text = await restoreFile.text();
      const json = JSON.parse(text);
      const result = await api("/super-admin/restore", { method: "POST", body: JSON.stringify(json), timeoutMs: 120000 });
      setRestoreResult(result);
    } catch (e: any) {
      setRestoreError(e.message ?? "Restore failed");
    }
    setRestoring(false);
  }

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-red-400 text-lg font-bold">⛔ Access Denied — SUPER_ADMIN only</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Database size={24} className="text-red-400" />
        <h1 className="text-xl font-bold text-white">Super Admin — DB Control Panel</h1>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(["tables", "users", "backup"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition ${tab === t ? "bg-red-500/20 text-red-400 border border-red-500/40 border-b-0" : "text-white/50 hover:text-white/80"}`}>
            {t === "tables" ? "📊 Browse Tables" : t === "users" ? "👤 All Users" : "💾 Backup"}
          </button>
        ))}
      </div>

      {/* Tables Tab */}
      {tab === "tables" && (
        <div className="space-y-4">
          {!selectedTable ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tables.map((t) => (
                <button key={t.name} onClick={() => browseTable(t.name)}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-left">
                  <div className="flex items-center gap-2"><Table size={16} className="text-blue-400" /><span className="text-sm font-medium text-white">{t.name}</span></div>
                  <span className="text-xs text-white/50">{t.rowCount} rows</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedTable(null); setTableData(null); }} className="text-white/60 hover:text-white">← Back</button>
                <h2 className="text-lg font-semibold text-white">{selectedTable}</h2>
                <span className="text-xs text-white/40">{tableData?.total ?? 0} rows</span>
                <button onClick={() => downloadTable(selectedTable)} className="ml-auto flex items-center gap-1 text-xs text-green-400 hover:text-green-300"><Download size={14} /> Export</button>
              </div>
              {loading ? <div className="text-center py-8 text-white/40">Loading...</div> : tableData?.rows?.length ? (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-white/5">{Object.keys(tableData.rows[0]).map((col) => (<th key={col} className="px-3 py-2 text-left text-white/60 font-medium whitespace-nowrap">{col}</th>))}</tr></thead>
                    <tbody>{tableData.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t border-white/5 hover:bg-white/5">{Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="px-3 py-2 text-white/80 whitespace-nowrap max-w-[200px] truncate">{val === null ? <span className="text-white/30">null</span> : typeof val === "object" ? JSON.stringify(val).slice(0, 50) : String(val).slice(0, 80)}</td>
                      ))}</tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <div className="text-center py-8 text-white/40">No data</div>}
              {tableData && tableData.total > 25 && (
                <div className="flex items-center justify-center gap-4">
                  <button disabled={page <= 1} onClick={() => browseTable(selectedTable, page - 1)} className="flex items-center gap-1 text-sm text-white/60 disabled:opacity-30"><ArrowLeft size={14} /> Prev</button>
                  <span className="text-xs text-white/40">Page {page} / {Math.ceil(tableData.total / 25)}</span>
                  <button disabled={page >= Math.ceil(tableData.total / 25)} onClick={() => browseTable(selectedTable, page + 1)} className="flex items-center gap-1 text-sm text-white/60 disabled:opacity-30">Next <ArrowRight size={14} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/50">Total: {users?.total ?? 0} users</span>
            <div className="flex items-center gap-3">
              <button onClick={() => exportUsersJSON()} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"><Download size={12} /> JSON</button>
              <button onClick={() => exportUsersExcel()} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Download size={12} /> Excel</button>
              <button disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)} className="text-xs text-white/60 disabled:opacity-30">← Prev</button>
              <span className="text-xs text-white/40">Page {usersPage}</span>
              <button disabled={!users || usersPage >= Math.ceil(users.total / 25)} onClick={() => setUsersPage(p => p + 1)} className="text-xs text-white/60 disabled:opacity-30">Next →</button>
            </div>
          </div>

          {loading && !users ? <div className="text-center py-8 text-white/40">Loading...</div> : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 text-white/60">
                    <th className="px-3 py-2 text-left"></th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left">FF UID</th>
                    <th className="px-3 py-2 text-left">Balance</th>
                    <th className="px-3 py-2 text-left">Payments</th>
                    <th className="px-3 py-2 text-left">Tournaments</th>
                    <th className="px-3 py-2 text-left">Withdrawals</th>
                    <th className="px-3 py-2 text-left">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.users?.map((u: any) => (
                    <><tr key={u.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => expandUser(u.id)}>
                      <td className="px-3 py-2 text-white/60">{expandedUser === u.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="px-3 py-2 text-white font-medium">{u.name ?? "—"}</td>
                      <td className="px-3 py-2 text-white/80">{u.email}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${u.role === "SUPER_ADMIN" ? "bg-red-500/20 text-red-400" : u.role === "ADMIN" ? "bg-purple-500/20 text-purple-400" : "bg-white/10 text-white/60"}`}>{u.role}</span></td>
                      <td className="px-3 py-2 text-white/70">{u.profile?.freeFireUid ?? "—"}</td>
                      <td className="px-3 py-2 text-green-400 font-medium">Rs {u.wallet?.balanceNpr ?? 0}</td>
                      <td className="px-3 py-2 text-white/70">{u._count?.payments ?? 0}</td>
                      <td className="px-3 py-2 text-white/70">{u._count?.tournaments ?? 0}</td>
                      <td className="px-3 py-2 text-white/70">{u._count?.withdrawals ?? 0}</td>
                      <td className="px-3 py-2 text-white/50">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                    {expandedUser === u.id && (
                      <tr key={`${u.id}-detail`}><td colSpan={10} className="p-0">
                        <UserDetail data={userDetail} />
                      </td></tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Backup Tab */}
      {tab === "backup" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center space-y-3">
            <Database size={48} className="mx-auto text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Manual Database Backup</h2>
            <p className="text-sm text-white/60">Download a full JSON export of all tables.</p>
            <button onClick={downloadBackup} className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-6 py-3 text-sm font-bold text-white hover:bg-yellow-500 transition">
              <Download size={18} /> Download Full DB Backup
            </button>
          </div>

          {/* Restore Section */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
            <h2 className="text-lg font-bold text-white text-center">⚠️ Restore from Backup</h2>
            <p className="text-sm text-white/60 text-center">Upload a previously exported backup JSON file to restore the database. This will <span className="text-red-400 font-semibold">overwrite existing data</span>.</p>
            <div className="flex flex-col items-center gap-3">
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-red-400"); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-red-400"); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-red-400"); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".json")) setRestoreFile(f); }}
                onClick={() => document.getElementById("restore-input")?.click()}
                className="w-full cursor-pointer rounded-xl border-2 border-dashed border-white/20 p-6 text-center transition hover:border-white/40"
              >
                <input id="restore-input" type="file" accept=".json" className="hidden" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
                <p className="text-sm text-white/50">{restoreFile ? `📄 ${restoreFile.name} (${(restoreFile.size / 1024).toFixed(1)} KB)` : "Drag & drop backup .json here or click to browse"}</p>
              </div>
              {restoreResult && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-400 w-full">
                  ✓ Restored {restoreResult.tables?.length} tables at {new Date(restoreResult.restoredAt).toLocaleString()}
                </div>
              )}
              {restoreError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 w-full">{restoreError}</div>
              )}
              <button
                onClick={handleRestore}
                disabled={!restoreFile || restoring}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500 transition disabled:opacity-40"
              >
                {restoring ? "Restoring..." : "🔄 Restore Database"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white/70">Export Individual Tables</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tables.map((t) => (
                <button key={t.name} onClick={() => downloadTable(t.name)}
                  className="flex items-center justify-between p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-xs">
                  <span className="text-white">{t.name}</span>
                  <span className="text-green-400 flex items-center gap-1"><Download size={12} /> Export</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDetail({ data }: { data: any }) {
  if (!data) return <div className="p-4 text-center text-white/40 text-xs">Loading user details...</div>;

  return (
    <div className="p-4 bg-white/[0.02] space-y-3 border-t border-white/5">
      {data.profile && (
        <div className="rounded-lg border border-white/10 p-3">
          <h5 className="text-xs font-semibold text-blue-400 mb-1">🎮 Profile</h5>
          <div className="grid grid-cols-3 gap-2 text-xs text-white/70">
            <div>IGN: <span className="text-white">{data.profile.ign ?? "—"}</span></div>
            <div>FF UID: <span className="text-white">{data.profile.freeFireUid ?? "—"}</span></div>
            <div>Level: <span className="text-white">{data.profile.level ?? "—"}</span></div>
          </div>
        </div>
      )}

      {data.wallet && (
        <div className="rounded-lg border border-green-500/20 p-3">
          <h5 className="text-xs font-semibold text-green-400 mb-1">💰 Wallet</h5>
          <span className="text-sm text-white font-bold">Rs {data.wallet.balanceNpr}</span>
        </div>
      )}

      {data.payments?.length > 0 && (
        <div className="rounded-lg border border-white/10 p-3">
          <h5 className="text-xs font-semibold text-yellow-400 mb-2">💳 Payments ({data.payments.length})</h5>
          <table className="w-full text-xs"><thead><tr className="text-white/50"><th className="text-left px-1">Amt</th><th className="text-left px-1">Status</th><th className="text-left px-1">Method</th><th className="text-left px-1">Ref</th><th className="text-left px-1">Date</th></tr></thead>
          <tbody>{data.payments.map((p: any) => (
            <tr key={p.id} className="border-t border-white/5">
              <td className="px-1 py-0.5 text-white">Rs {p.amountNpr}</td>
              <td className="px-1 py-0.5"><span className={p.status === "APPROVED" ? "text-green-400" : p.status === "REJECTED" ? "text-red-400" : "text-yellow-400"}>{p.status}</span></td>
              <td className="px-1 py-0.5 text-white/70">{p.method}</td>
              <td className="px-1 py-0.5 text-white/50 max-w-[100px] truncate">{p.reference ?? "—"}</td>
              <td className="px-1 py-0.5 text-white/50">{new Date(p.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {data.tournaments?.length > 0 && (
        <div className="rounded-lg border border-white/10 p-3">
          <h5 className="text-xs font-semibold text-purple-400 mb-2">🏆 Tournaments ({data.tournaments.length})</h5>
          <table className="w-full text-xs"><thead><tr className="text-white/50"><th className="text-left px-1">Title</th><th className="text-left px-1">Status</th><th className="text-left px-1">Paid</th><th className="text-left px-1">Joined</th></tr></thead>
          <tbody>{data.tournaments.map((tp: any) => (
            <tr key={tp.id} className="border-t border-white/5">
              <td className="px-1 py-0.5 text-white">{tp.tournament?.title ?? tp.tournamentId}</td>
              <td className="px-1 py-0.5 text-white/70">{tp.tournament?.status}</td>
              <td className="px-1 py-0.5">{tp.paid ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
              <td className="px-1 py-0.5 text-white/50">{new Date(tp.joinedAt).toLocaleDateString()}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {data.withdrawals?.length > 0 && (
        <div className="rounded-lg border border-white/10 p-3">
          <h5 className="text-xs font-semibold text-orange-400 mb-2">🏧 Withdrawals ({data.withdrawals.length})</h5>
          <table className="w-full text-xs"><thead><tr className="text-white/50"><th className="text-left px-1">Amt</th><th className="text-left px-1">Status</th><th className="text-left px-1">Method</th><th className="text-left px-1">Date</th></tr></thead>
          <tbody>{data.withdrawals.map((w: any) => (
            <tr key={w.id} className="border-t border-white/5">
              <td className="px-1 py-0.5 text-white">Rs {w.amountNpr}</td>
              <td className="px-1 py-0.5"><span className={w.status === "COMPLETED" ? "text-green-400" : w.status === "REJECTED" ? "text-red-400" : "text-yellow-400"}>{w.status}</span></td>
              <td className="px-1 py-0.5 text-white/70">{w.method ?? "—"}</td>
              <td className="px-1 py-0.5 text-white/50">{new Date(w.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}
    </div>
  );
}
