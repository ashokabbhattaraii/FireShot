# Firebase Cloud Messaging (FCM) Setup Guide

Complete guide to enable real-time push notifications in the FireSlot Nepal APK.

---

## Overview

The push notification system works as follows:

```
[Backend creates Notification in DB]
        ↓ (Prisma middleware)
[FCM sends push to device tokens]
        ↓
[Android APK receives push]
        ↓
[Shows notification in system tray / foreground local notification]
        ↓
[User taps → app navigates to relevant screen]
```

All 40+ notification triggers (payments, tournaments, challenges, wallet, results, etc.) automatically send push notifications — no per-feature wiring needed.

---

## Prerequisites

- Firebase account (free tier is sufficient)
- Android Studio (for building the APK)
- Node.js 18+ and pnpm 9
- The FireSlot Nepal project cloned and dependencies installed

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project**
3. Name it (e.g., `fireslot-nepal`)
4. Disable Google Analytics (optional, not needed for FCM)
5. Click **Create project**

---

## Step 2: Register the Android App

1. In your Firebase project, click **Add app** → **Android**
2. Enter the package name: `com.fireslot.nepal`
3. App nickname: `FireSlot Nepal`
4. SHA-1 (optional for push, required for Google Sign-In):
   ```bash
   cd apps/web/android
   ./gradlew signingReport 2>&1 | grep "SHA1"
   ```
5. Click **Register app**

---

## Step 3: Download `google-services.json`

1. Firebase will prompt you to download `google-services.json`
2. Place it at:
   ```
   apps/web/android/app/google-services.json
   ```
3. **Do NOT commit this file** — it's already in `.gitignore`

Verify placement:
```bash
ls apps/web/android/app/google-services.json
```

---

## Step 4: Generate the Service Account Key (Backend)

1. In Firebase Console → **Project Settings** → **Service Accounts** tab
2. Select **Firebase Admin SDK** → **Node.js**
3. Click **Generate new private key**
4. Save the downloaded JSON file

---

## Step 5: Configure Environment Variables

Add the service account JSON to your backend `.env`:

```bash
# Option A: Paste the full JSON (escape newlines in private_key)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"fireslot-nepal","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@fireslot-nepal.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40fireslot-nepal.iam.gserviceaccount.com"}'

# Option B: Base64-encode the JSON (useful for platforms with character limits)
FIREBASE_SERVICE_ACCOUNT_JSON="eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii..."
```

To base64-encode:
```bash
cat path/to/firebase-service-account.json | base64 -w 0
```

---

## Step 6: Sync Capacitor and Build APK

```bash
cd apps/web

# Build the web app
pnpm build

# Sync native project with Capacitor
npx cap sync android

# Build the APK
cd android
./gradlew assembleRelease
```

The signed APK will be at:
```
apps/web/android/app/build/outputs/apk/release/app-release.apk
```

---

## Step 7: Test Push Notifications

### Send a test notification from Firebase Console:

1. Firebase Console → **Messaging** → **Create your first campaign**
2. Select **Firebase Notification messages**
3. Enter title and body
4. Target: Select your app `com.fireslot.nepal`
5. Click **Send test message**
6. Paste a device FCM token (see below how to get one)

### Get a device token for testing:

After installing the APK and logging in, the token is automatically registered. Check the backend logs or query the database:

```sql
SELECT token FROM "UserPushToken" WHERE "userId" = 'your-user-id' LIMIT 1;
```

### Test via the API (trigger a notification create):

Any action that creates a notification will now push. For example:
- Approve a payment in admin panel
- Change a tournament status
- Send a support reply

---

## Architecture

### Backend Flow

```
apps/api/src/prisma/prisma.module.ts
  └── Prisma $use middleware
      └── On Notification.create → sendFcmForNotification()
          ├── Queries UserPushToken table for user's device tokens
          ├── Sends FCM message with high priority
          └── Auto-deletes invalid/expired tokens

apps/api/src/config/firebase.config.ts
  └── Lazy-loads firebase-admin with FIREBASE_SERVICE_ACCOUNT_JSON
  └── Exports getMessaging() for FCM operations
```

### Frontend Flow

```
apps/web/src/components/NativeBootstrap.tsx
  └── usePushNotifications() hook
      ├── Checks if native platform + user logged in
      ├── Requests notification permission
      ├── Registers with FCM → gets device token
      ├── Posts token to POST /api/users/push-token
      ├── Listens for foreground pushes → shows local notification
      └── Listens for notification tap → navigates to route

apps/web/capacitor.config.ts
  └── PushNotifications plugin configured
```

### Database

```prisma
model UserPushToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  platform  String   @default("android")
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Notification Types That Trigger Push

| Event | Notification Type | When |
|-------|------------------|------|
| Payment approved/rejected | `PAYMENT` | Admin approves/rejects payment proof |
| Tournament status change | `TOURNAMENT` | Match goes LIVE, ends, or cancelled |
| Room details published | `TOURNAMENT` | Room ID + password shared |
| Prize credited | `WALLET` | Winner declared, wallet credited |
| Challenge matched | `CHALLENGE` | Opponent joins your challenge |
| Challenge result | `CHALLENGE` | Dispute resolved, result verified |
| Withdrawal processed | `WALLET` | Admin processes withdrawal |
| Referral reward | `REFERRAL` | Friend's first deposit |
| Support reply | `SUPPORT` | Admin replies to ticket |
| Account action | `GENERAL` | Ban, unban, lock |

---

## Customizing Notification Appearance

### Android notification icon

Place your notification icon at:
```
apps/web/android/app/src/main/res/drawable-xxxhdpi/ic_stat_notification.png
```

Requirements: 24×24dp, white on transparent, PNG.

### Notification channel (Android 8+)

The default channel is created by Capacitor. To customize sound/vibration, edit:
```
apps/web/android/app/src/main/java/com/fireslot/nepal/MainActivity.java
```

---

## Troubleshooting

### Push not received

1. **Check `google-services.json` is in place:**
   ```bash
   cat apps/web/android/app/google-services.json | jq .project_info.project_id
   ```

2. **Check `FIREBASE_SERVICE_ACCOUNT_JSON` is set:**
   Look for this log on API startup:
   ```
   [FirebaseConfig] Firebase Admin initialized
   ```
   If you see `push notifications disabled`, the env var is missing or malformed.

3. **Check device token is registered:**
   ```sql
   SELECT * FROM "UserPushToken" ORDER BY "updatedAt" DESC LIMIT 5;
   ```

4. **Check for FCM errors in API logs:**
   ```
   [FCM] FCM send error: ...
   ```

### Token automatically deleted

If a user uninstalls and reinstalls, the old token becomes invalid. The middleware automatically deletes stale tokens when FCM returns `messaging/registration-token-not-registered`.

### Foreground notifications not showing

On Android, FCM data messages in the foreground are handled by the app. The hook uses `@capacitor/local-notifications` to display them. Ensure the local notifications permission is granted.

### Notification tap not navigating

The push payload must include a `route` field in `data`. The backend currently sends `type` only. To add navigation, include route data when creating notifications:

```typescript
await prisma.notification.create({
  data: {
    userId,
    type: "TOURNAMENT",
    title: "Match is LIVE!",
    body: "Your tournament has started",
    // The middleware sends `type` as data. For navigation,
    // services can also call pushService.sendToUser() with route data.
  },
});
```

For route-based navigation, use `PushService.sendToUser()` directly with `data: { route: "/tournaments/xyz" }`.

---

## Production Deployment Checklist

- [ ] `google-services.json` in `apps/web/android/app/`
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` set in production env
- [ ] APK built with `assembleRelease` (not debug)
- [ ] APK signed with your release keystore
- [ ] Tested on physical device (emulators may not support FCM)
- [ ] Verified notification appears when payment is approved
- [ ] Verified tap on notification opens the correct screen

---

## Security Notes

- `google-services.json` is public configuration (safe to ship in APK, not a secret)
- `FIREBASE_SERVICE_ACCOUNT_JSON` is a **secret** — never expose in client code or commit to git
- Device tokens are stored per-user and auto-cleaned when invalid
- The push middleware is fire-and-forget — FCM failures never block the main request
