'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SplashScreen } from './SplashScreen'
import { useLocalNotifications } from '@/hooks/useLocalNotifications'

export function RootClient({ children }: { children: React.ReactNode }) {
  const [splashVisible, setSplashVisible] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useLocalNotifications()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('fs_token') : null
        if (!token) {
          setAuthChecked(true)
          return
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
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
