# MainActivity WebView Cache Clear Patch

## Problem
After building an APK with stale CSS from previous file:// builds, the Android WebView caches old static assets. Even when Capacitor points to the live HTTPS server, cached CSS from the file:// build prevents new CSS from loading.

## Solution
Add WebView cache clearing to `MainActivity.java` (only during development).

## Steps

### 1. After running `npx cap add android`, locate:
```
apps/web/android/app/src/main/java/com/fireslot/nepal/MainActivity.java
```

### 2. Add imports at the top:
```java
import android.webkit.WebView;
import android.os.Bundle;
```

### 3. Add cache clear in onCreate():
```java
@Override
protected void onCreate(Bundle savedInstanceState) {
    // Clear WebView cache on first run to eliminate stale file:// CSS
    // Remove this before production release
    WebView.setWebContentsDebuggingEnabled(true);
    WebView.clearCache(true); // ← add this line
    
    super.onCreate(savedInstanceState);
}
```

### 4. Also update `android/app/src/main/res/xml/config.xml`:
Add (or update if exists):
```xml
<preference name="CacheMode" value="LOAD_DEFAULT" />
<preference name="DisallowOverscroll" value="true" />
```

## Result
- First APK build clears all cached CSS
- New CSS loads correctly from live HTTPS server
- Users see fully styled pages (not skeleton HTML)

## Important Notes
- Remove `WebView.clearCache(true)` before production release (it's slow on every app start)
- Development builds should keep it enabled
- If CSS still doesn't load after APK reinstall, check:
  1. `capacitor.config.ts` webDir is set to 'public'
  2. `next.config.js` has assetPrefix set to LIVE_URL for capacitor builds
  3. `Build-apk.sh` uses `BUILD_TARGET=capacitor`
