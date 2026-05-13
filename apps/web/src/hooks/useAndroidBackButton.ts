"use client"
import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

export function useAndroidBackButton() {
  const router = useRouter()
  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return
    let mounted = true
    const handler = App.addListener('backButton', (ev) => {
      // ev may contain `canGoBack` depending on Capacitor version
      const canGoBack = (ev as any).canGoBack
      if (canGoBack) {
        router.back()
      } else {
        // At root — minimize app
        try { App.minimizeApp() } catch { /* ignore */ }
      }
    })
    return () => {
      mounted = false
      handler.then((h) => h.remove()).catch(() => {})
    }
  }, [router])
}
