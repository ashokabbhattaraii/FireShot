# Firebase Setup (Required for Push Notifications)

Push notifications are currently DISABLED until Firebase is configured.
Local notifications work without Firebase.

## Steps to enable FCM push notifications:

1. Go to https://console.firebase.google.com
2. Create project: "FireSlot Nepal"
3. Add Android app:
   - Package name: com.fireslot.nepal
   - App nickname: FireSlot Nepal
   - SHA-1: run `cd android && ./gradlew signingReport` to get it
4. Download `google-services.json`
5. Place it at: `android/app/google-services.json`
6. In `android/app/build.gradle` add:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
7. In `android/build.gradle` add to dependencies:
   ```gradle
   classpath 'com.google.gms:google-services:4.4.0'
   ```
8. Set FIREBASE_SERVICE_ACCOUNT_JSON in `apps/api/.env`:
   base64 encode the Firebase Admin SDK JSON from Firebase Console > Project Settings > Service Accounts
9. Uncomment push notification code in `usePushNotifications.ts`
10. Run: `npx cap sync android && ./gradlew assembleRelease`
