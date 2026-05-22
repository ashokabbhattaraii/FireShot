# Google OAuth Setup for FireSlot Nepal

## Required in Google Cloud Console

### Authorized JavaScript Origins
- https://fire-shot-web.vercel.app
- http://localhost:3000

### Authorized Redirect URIs
- https://fire-shot-web.vercel.app/login
- http://localhost:3000/login

## Environment Variables
### apps/web/.env.local (local dev — do not commit)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

### apps/web/.env.capacitor (APK build — safe to commit, public vars only)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://fire-shot-web.vercel.app/login
NEXT_PUBLIC_GOOGLE_USE_SYSTEM_BROWSER=true
NEXT_PUBLIC_APP_URL=https://fire-shot-web.vercel.app
CAPACITOR_SERVER_URL=https://fire-shot-web.vercel.app

### apps/api/.env (server — never commit)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
