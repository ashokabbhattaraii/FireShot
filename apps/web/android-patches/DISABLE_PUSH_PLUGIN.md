# Disable Push Notifications Plugin

Until google-services.json is configured, the push plugin may crash the app on launch.

## Steps to disable:

1. In `android/app/build.gradle`, remove or comment any `implementation` line for the capacitor push plugin.
2. In `android/app/src/main/java/.../MainActivity.java`, remove the PushNotifications plugin registration if present.
3. Run: `npx cap sync android`
4. Rebuild APK: `./gradlew assembleRelease`

## To re-enable later:
1. Create Firebase project at https://console.firebase.google.com
2. Add Android app with package: `com.fireslot.nepal`
3. Download `google-services.json` → place in `android/app/`
4. Re-add plugin to build.gradle
5. Uncomment push notification code in `usePushNotifications.ts`
6. Run: `npx cap sync android` and rebuild
