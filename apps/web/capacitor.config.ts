import { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://esport-web-rho.vercel.app'
const serverHost = new URL(serverUrl).hostname

const config: CapacitorConfig = {
  appId: 'com.fireslot.nepal',
  appName: 'FireSlot Nepal',
  webDir: 'capacitor-shell',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [serverHost, '*.esport-web-rho.vercel.app', '*.fireslot.vercel.app', 'esport-api-steel.vercel.app', 'accounts.google.com', '*.googleapis.com'],
    hostname: serverHost,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#0B0B14', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0B0B14', overlaysWebView: false },
    LocalNotifications: { smallIcon: 'ic_stat_notification', iconColor: '#E53935' },
  },
  android: { allowMixedContent: false, captureInput: true, webContentsDebuggingEnabled: false },
}

export default config
