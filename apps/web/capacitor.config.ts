import { CapacitorConfig } from '@capacitor/cli'

const productionWebUrl = 'https://fire-shot-web.vercel.app'
const productionApiHost = 'fire-shot-api.vercel.app'
const serverUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || productionWebUrl
const serverHost = new URL(serverUrl).hostname

const config: CapacitorConfig = {
  appId: 'com.fireslot.nepal',
  appName: 'FireSlot Nepal',
  webDir: 'capacitor-shell',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      serverHost,
      'fire-shot-web.vercel.app',
      productionApiHost,
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
    ],
    hostname: serverHost,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#0B0B14', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0B0B14', overlaysWebView: false },
    LocalNotifications: { smallIcon: 'ic_stat_notification', iconColor: '#E53935' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
  android: { allowMixedContent: false, captureInput: true, webContentsDebuggingEnabled: false },
}

export default config
