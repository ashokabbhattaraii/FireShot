'use client'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

export function useLocalNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const init = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')

        const perm = await LocalNotifications.checkPermissions()
        if (perm.display === 'prompt') {
          const result = await LocalNotifications.requestPermissions()
          if (result.display !== 'granted') return
        }

        await LocalNotifications.addListener('localNotificationActionPerformed', (action: any) => {
          const data = action.notification.extra
          if (!data?.route) return
          window.location.href = data.route
        })

        console.log('Local notifications ready')
      } catch (e) {
        console.warn('Local notifications unavailable:', e)
      }
    }

    init()
  }, [])
}

export async function sendLocalNotification(title: string, body: string, route?: string) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now(),
        title,
        body,
        schedule: { at: new Date(Date.now() + 200) },
        extra: route ? { route } : undefined,
      }]
    })
  } catch {}
}
