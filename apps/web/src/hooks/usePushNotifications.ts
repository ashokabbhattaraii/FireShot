"use client"
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// FIREBASE NOT CONFIGURED: Push notifications disabled until google-services.json is added
// To enable, follow apps/web/FIREBASE_SETUP.md and re-enable the hook logic
export function usePushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    // Intentionally disabled to avoid native crash when Firebase is not configured
    // Uncomment and implement initialization after adding google-services.json
    /*
    const init = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        // registration logic here
      } catch (e) {
        console.warn('Push unavailable', e)
      }
    }
    init()
    */
  }, [])
}
