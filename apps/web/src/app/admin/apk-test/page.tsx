'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { PageLoading } from '@/components/ui'

interface TestSession {
  id: string
  adminId: string
  buildVersion: string
  status: string
  startedAt: string
  endedAt?: string
  bugsFound: any[]
  testNotes?: string
}

export default function ApkTestPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [bugs, setBugs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, b] = await Promise.all([
          api('/admin/apk-test/sessions').catch(() => []),
          api('/admin/apk-test/bugs').catch(() => []),
        ])
        setSessions(s || [])
        setBugs(b || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <PageLoading label="Loading APK tests..." />

  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length
  const totalBugs = bugs.length
  const resolved = sessions.filter((s) => s.status === 'COMPLETED').length

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Testing</p>
        <h1 className="font-display text-2xl">APK Bug Reports</h1>
      </div>

      <div className="grid gap-4 grid-cols-3">
        <div className="card p-4">
          <p className="text-white/60 text-sm">Active Sessions</p>
          <p className="font-display text-3xl mt-2">{activeSessions}</p>
        </div>
        <div className="card p-4">
          <p className="text-white/60 text-sm">Total Bugs This Week</p>
          <p className="font-display text-3xl mt-2">{totalBugs}</p>
        </div>
        <div className="card p-4">
          <p className="text-white/60 text-sm">Resolved</p>
          <p className="font-display text-3xl mt-2">{resolved}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-4">Bug Reports</h2>
        {bugs.length ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2">Session</th>
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Build</th>
                  <th className="text-left p-2">Reported</th>
                </tr>
              </thead>
              <tbody>
                {bugs.map((b, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="p-2 text-xs font-mono">{b.sessionId.slice(0, 8)}</td>
                    <td className="p-2">{b.title}</td>
                    <td className="p-2 text-xs">{b.buildVersion}</td>
                    <td className="p-2 text-xs text-white/50">{new Date(b.reportedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-white/40 text-center py-8">No bugs reported</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-4">Test Sessions</h2>
        {sessions.length ? (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border border-border/30 rounded">
                <div>
                  <p className="font-semibold">{s.buildVersion}</p>
                  <p className="text-xs text-white/50">{new Date(s.startedAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${s.status === 'ACTIVE' ? 'text-green-500' : 'text-white/50'}`}>
                    {s.status}
                  </p>
                  <p className="text-xs text-white/40">{s.bugsFound?.length || 0} bugs</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-center py-8">No sessions yet</p>
        )}
      </div>
    </div>
  )
}
