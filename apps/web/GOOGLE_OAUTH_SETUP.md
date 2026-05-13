# Google OAuth Setup for FireSlot Nepal

## Required in Google Cloud Console

### Authorized JavaScript Origins
- https://fireslot.vercel.app
- capacitor://fireslot.vercel.app  ← required for Android APK
- capacitor://localhost             ← required for Android debug
- http://localhost:3000             ← local dev

### Authorized Redirect URIs
- https://fireslot.vercel.app/api/auth/callback/google
- http://localhost:3000/api/auth/callback/google

## Environment Variables
### apps/web/.env.local (local dev — do not commit)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

### apps/web/.env.capacitor (APK build — safe to commit, public vars only)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
NEXT_PUBLIC_APP_URL=https://fireslot.vercel.app

### apps/api/.env (server — never commit)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
