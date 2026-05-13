# In-App Update Checker Documentation

## Overview

The in-app update checker allows users to receive update notifications when a new version of the FireSlot Nepal app is available. The system checks for updates periodically and prompts users to download and install the latest version.

## Components

### 1. Backend (`apps/api`)

#### App Releases Module
- **Endpoint**: `GET /app/config`
- **Response**: Returns update information including:
  - `update.latestVersion` - Latest available app version
  - `update.downloadUrl` - URL to download the APK
  - `update.force` - Whether update is mandatory
  - `update.minAndroidVersion` - Minimum required version

#### System Config Keys
- `APP_LATEST_VERSION` - Latest available app version (e.g., "1.0.86-129a789")
- `APP_MIN_ANDROID_VERSION` - Minimum required version (e.g., "1.0.0")
- `APP_FORCE_UPDATE_ENABLED` - Force update flag (boolean)
- `APP_DOWNLOAD_ENABLED` - Enable/disable update downloads (boolean)

### 2. Frontend (`apps/web`)

#### Update Checker Service (`lib/update-checker.ts`)
- `checkForUpdates()` - Fetches update info from backend
- `compareVersions()` - Compares version strings
- `downloadAndInstallAPK()` - Opens download URL
- `startUpdateCheckInterval()` - Periodic update checking

#### Update Hook (`hooks/useAppUpdates.ts`)
- `useAppUpdates()` - React hook to manage update state
- Checks for updates on mount and every 6 hours
- Handles installation and dismissal

#### Update Modal (`components/AppUpdateModal.tsx`)
- Beautiful modal UI for update prompts
- Shows current and latest version
- Displays release notes
- Handles force/optional updates
- Loading states during download

#### Update Context (`lib/update-context.tsx`)
- `UpdateProvider` - Context provider for update management
- Wrapped in main `Providers` component
- Auto-shows update modal when available

## Usage Flow

### User Flow
1. App starts → Update check runs automatically
2. If update available → Modal appears
3. User taps "Update Now" → Browser opens APK download
4. Android system handles installation
5. User taps "Later" (optional updates only) → Modal dismissed

### Admin Flow
1. Navigate to Admin → Configuration
2. Find "App Update Settings" section
3. Update `APP_LATEST_VERSION` to new version string
4. Upload new APK to Downloads folder (manual step)
5. Enable `APP_FORCE_UPDATE_ENABLED` if critical
6. Click Save
7. Users will see update prompt on next check

## Configuration

### Setting up a New Release

1. **Build the APK**
   ```bash
   pnpm --filter @fireslot/web build:apk
   ```
   This generates: `fireslot-nepal-1.0.XX-COMMITHASH.apk`

2. **Upload to downloads folder**
   ```bash
   # Copy to public downloads folder
   cp apps/web/android/app/build/outputs/apk/debug/app-debug.apk public/downloads/fireslot-nepal-1.0.XX-COMMITHASH.apk
   ```

3. **Update admin config**
   - Go to Admin → Configuration → App Update Settings
   - Set `APP_LATEST_VERSION` to your new version (e.g., "1.0.86-129a789")
   - Optionally set `APP_FORCE_UPDATE_ENABLED` to true for critical updates
   - Click Save

4. **Download URL**
   - The backend automatically serves from `/public/downloads/`
   - No manual URL configuration needed if APK is in the downloads folder

## Version String Format

Version strings follow this format:
```
MAJOR.MINOR.PATCH[-PRERELEASE]
Examples:
- 1.0.0 (simple version)
- 1.0.86 (with patch)
- 1.0.86-129a789 (with git commit hash)
```

The version comparison logic:
1. Compares MAJOR version (e.g., 1 vs 2)
2. Compares MINOR version (e.g., 0 vs 1)
3. Compares PATCH version (e.g., 0 vs 86)
4. Prerelease/commit hash ignored in comparison

## Forced Updates

When `APP_FORCE_UPDATE_ENABLED` is true:
- Users cannot dismiss the update modal
- Modal shows "Required" badge
- Error message says "This update is required to continue using the app"
- Perfect for critical security patches or breaking changes

## Optional Updates

When `APP_FORCE_UPDATE_ENABLED` is false:
- Users can dismiss with "Later" button
- Update prompt can be dismissed
- Checked again in 6 hours

## Testing

### Testing in Development

1. Simulate an update check:
   ```javascript
   // In browser console
   const result = await fetch('/app/config').then(r => r.json());
   console.log(result.update);
   ```

2. Manual trigger:
   ```javascript
   // In React component
   import { useAppUpdates } from '@/hooks/useAppUpdates';
   const { installUpdate } = useAppUpdates();
   // Call installUpdate() to trigger download
   ```

### Testing Version Comparison

```javascript
import { compareVersions } from '@/lib/update-checker';

compareVersions("1.0.86", "1.0.85"); // Returns 1 (first is newer)
compareVersions("1.0.85", "1.0.86"); // Returns -1 (second is newer)
compareVersions("1.0.85", "1.0.85"); // Returns 0 (equal)
```

## Troubleshooting

### Update not showing
- Check `APP_DOWNLOAD_ENABLED` is true
- Verify `APP_LATEST_VERSION` is higher than current app version
- Check browser console for fetch errors

### Download not working
- Ensure APK file exists in `/public/downloads/`
- Verify download URL in `/app/config` response
- Check network tab in DevTools for HTTP errors

### Version comparison issues
- Ensure version format is correct (semver compatible)
- Prerelease versions are treated as equal to main version
- Example: "1.0.0" and "1.0.0-rc1" compare as equal

## Future Enhancements

1. **GitHub Actions CI/CD** - Automatic APK builds on push
2. **Google Play Store** - Native Android auto-update
3. **Firebase App Distribution** - Tester distribution
4. **In-app Changelog** - Show detailed release notes
5. **Metrics Dashboard** - Track update adoption rates
6. **Rollout Strategy** - Gradual rollout to users
7. **A/B Testing** - Test update prompts

## Files Modified

- `apps/web/src/lib/update-checker.ts` - Core update checking logic
- `apps/web/src/hooks/useAppUpdates.ts` - React hook for updates
- `apps/web/src/components/AppUpdateModal.tsx` - UI component
- `apps/web/src/lib/update-context.tsx` - Context provider
- `apps/web/src/app/providers.tsx` - Integration with main providers
- `apps/web/src/app/admin/config/page.tsx` - Admin configuration UI

## Related Documentation

- [APK Build Pipeline](../../build-apk.sh) - Automated versioning
- [System Configuration](../api/src/modules/admin/system-config.service.ts) - Config management
- [App Releases Module](../api/src/modules/app-releases/) - Backend service
