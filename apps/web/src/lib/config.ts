export const config = {
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'https://fire-shot-api.vercel.app/api',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
  isNative: process.env.NEXT_PUBLIC_IS_NATIVE === 'true',
}
