'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SplashScreen } from './SplashScreen'
import { useLocalNotifications } from '@/hooks/useLocalNotifications'
import { API_BASE } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useUserRealtime } from '@/hooks/useUserRealtime'
import { useToast } from '@/lib/toast'
import { useHaptics } from '@/hooks/useHaptics'
import { sendLocalNotification } from '@/hooks/useLocalNotifications'

export function RootClient({ children }: { children: React.ReactNode }) {
  const [splashVisible, setSplashVisible] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const toast = useToast()
  const haptics = useHaptics()

  useLocalNotifications()

  useUserRealtime({
    onNotification: async (payload: any) => {
      const title = String(payload?.title ?? 'Notification')
      const body = String(payload?.body ?? 'You have a new update.')
      toast.info(body ? `${title} • ${body}` : title)
      await haptics.success().catch(() => {})
      await sendLocalNotification(title, body, payload?.data?.route).catch(() => {})
    },
  })

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('fs_token') : null
        if (!token) {
          setAuthChecked(true)
          return
        }
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) {
          localStorage.removeItem('fs_token')
        }
      } catch {}
      setAuthChecked(true)
    }
    checkAuth()
  }, [])

  const handleSplashComplete = () => {
    setSplashVisible(false)
    const token = typeof window !== 'undefined' ? localStorage.getItem('fs_token') : null
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname
    const publicRoutes = ['/', '/login', '/tournaments', '/leaderboard', '/challenges']
    if (!token && !publicRoutes.includes(normalizedPath)) {
      router.replace('/login')
    }
  }

  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const readyToHide = authChecked && minTimeElapsed

  useEffect(() => {
    if (readyToHide && splashVisible) {
      setTimeout(handleSplashComplete, 100)
    }
  }, [readyToHide])

  return (
    <>
      {splashVisible && <SplashScreen onComplete={handleSplashComplete} />}
      {!splashVisible && children}
    </>
  )
}
