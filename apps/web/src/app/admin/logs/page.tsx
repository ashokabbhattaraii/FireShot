"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TableLoading } from "@/components/ui";

interface Log {
  id: string;
  adminId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: any;
  newValue: any;
  ip: string | null;
  createdAt: string;
  admin: { email: string; name: string | null };
}

export default function LogsPage() {
  const [data, setData] = useState<{ items: Log[]; total: number } | null>(null);
  const [resource, setResource] = useState("");
  const [adminId, setAdminId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (resource) q.set("resource", resource);
      if (adminId.trim()) q.set("adminId", adminId.trim());
      if (resourceId.trim()) q.set("resourceId", resourceId.trim());
      if (action.trim()) q.set("action", action.trim());
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const r = await api<{ items: Log[]; total: number }>(`/admin/logs?${q}`);
      setData(r);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, resource, adminId, resourceId, action, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Audit Logs</h1>
      </div>
      <div className="card grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <select className="input w-40" value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }}>
          <option value="">All resources</option>
          <option value="config">config</option>
          <option value="role">role</option>
          <option value="user">user</option>
          <option value="payment">payment</option>
          <option value="withdrawal">withdrawal</option>
          <option value="free_daily_window">free_daily_window</option>
        </select>
        <input className="input" placeholder="Actor ID" value={adminId} onChange={(e) => { setAdminId(e.target.value); setPage(1); }} />
        <input className="input" placeholder="Target/resource ID" value={resourceId} onChange={(e) => { setResourceId(e.target.value); setPage(1); }} />
        <input className="input" placeholder="Action contains" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        <input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {loading ? (
        <TableLoading columns={7} rows={8} />
      ) : (
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-white/50">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Admin</th>
              <th className="text-left p-2">Action</th>
              <th className="text-left p-2">Resource</th>
              <th className="text-left p-2">Resource ID</th>
              <th className="text-left p-2">Diff</th>
              <th className="text-left p-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-2 text-white/70">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="p-2">{l.admin?.email}</td>
                <td className="p-2 text-neon-cyan font-mono">{l.action}</td>
                <td className="p-2">{l.resource}</td>
                <td className="p-2 font-mono text-white/60">{l.resourceId ?? "—"}</td>
                <td className="p-2">
                  {l.oldValue && <pre className="text-[10px] text-red-300">{JSON.stringify(l.oldValue)}</pre>}
                  {l.newValue && <pre className="text-[10px] text-neon-green">{JSON.stringify(l.newValue)}</pre>}
                </td>
                <td className="p-2 text-white/50">{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <div className="flex items-center gap-3">
        <button disabled={loading || page <= 1} onClick={() => setPage(page - 1)} className="btn-outline">Prev</button>
        <span className="text-sm text-white/60">Page {page} of {Math.max(1, Math.ceil((data?.total ?? 0) / 50))}</span>
        <button disabled={loading || (data?.items.length ?? 0) < 50} onClick={() => setPage(page + 1)} className="btn-outline">Next</button>
      </div>
    </div>
  );
}
