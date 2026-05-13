"use client"

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'

export default function ApkTestPanel() {
  const isNative = useIsNativeApp()
  const { user } = useAuth()
  const isAdmin = !!user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [reporting, setReporting] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [bugsCount, setBugsCount] = useState(0)

  useEffect(() => {
    if (!isNative || !isAdmin) return
    // Try to fetch active sessions for this admin
    api('/admin/apk-test/sessions').then((s) => {
      const active = (s || []).find((x: any) => x.status === 'ACTIVE')
      if (active) setSession(active)
    }).catch(() => {})
  }, [isNative, isAdmin])

  if (!isNative || !isAdmin) return null

  async function captureScreen() {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(document.body as any, { useCORS: true, scale: 0.5, logging: false })
    return canvas.toDataURL('image/jpeg', 0.7)
  }

  async function startSession() {
    try {
      const buildVersion = process.env.NEXT_PUBLIC_APP_VERSION || `1.0.0-test-${Date.now()}`
      const deviceInfo = { ua: navigator.userAgent, screen: { w: screen.width, h: screen.height } }
      const created = await api('/admin/apk-test/start', { method: 'POST', body: JSON.stringify({ buildVersion, deviceInfo }) })
      setSession(created)
    } catch (err) {
      console.error(err)
      alert('Could not start test session')
    }
  }

  async function report() {
    if (!session) return
    if (!title.trim()) return alert('Add a short title')
    setReporting(true)
    try {
      const screenshot = await captureScreen()
      await api(`/admin/apk-test/${session.id}/bug`, { method: 'POST', body: JSON.stringify({ title: title.trim(), description: message.trim(), screenshotUrl: screenshot }) })
      setTitle('')
      setMessage('')
      setBugsCount((c) => c + 1)
      // temporary feedback
      setTimeout(() => { /* noop */ }, 2000)
    } catch (err) {
      console.error(err)
      alert('Could not report bug')
    } finally {
      setReporting(false)
    }
  }

  async function endSession() {
    if (!session) return
    try {
      await api(`/admin/apk-test/${session.id}/end`, { method: 'PUT', body: JSON.stringify({ testNotes: '' }) })
      setSession(null)
    } catch (err) {
      console.error(err)
      alert('Could not end session')
    }
  }

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 80, zIndex: 9999 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} aria-label="Open APK Test" style={{ width: 52, height: 52, borderRadius: 26, background: '#E53935', color: 'white', boxShadow: '0 6px 18px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🐞
        </button>
      ) : (
        <div style={{ width: 320, borderRadius: 12, background: '#0b0b0b', padding: 12, color: 'white', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold' }}>APK Test Mode</div>
            <div>
              <button onClick={() => setOpen(false)} style={{ marginRight: 8 }}>Close</button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            {session ? (
              <div>
                <div style={{ color: '#58d68d', fontWeight: '600' }}>Session Active</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Build: {session.buildVersion}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Bugs: {bugsCount}</div>

                <div style={{ marginTop: 10 }}>
                  <input placeholder="Bug title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #222', background: '#0b0b0b', color: 'white' }} />
                  <textarea placeholder="Details (optional)" value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #222', background: '#0b0b0b', color: 'white', marginTop: 8 }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={report} disabled={reporting} className="btn-primary">{reporting ? 'Reporting...' : 'Report Bug'}</button>
                    <button onClick={endSession} className="btn-outline">End Session</button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginTop: 6 }}>No active session</div>
                <div style={{ marginTop: 10 }}>
                  <button onClick={startSession} className="btn-primary">Start Test Session</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
