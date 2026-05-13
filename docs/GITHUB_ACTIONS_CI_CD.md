# GitHub Actions CI/CD Setup for APK Auto-Build

## Overview

This GitHub Actions workflow automatically builds the FireSlot Nepal APK and creates releases whenever code is pushed to the `main` branch. Users will see update notifications in the app and can download the new version.

## What It Does

✅ Triggers on every push to `main` branch  
✅ Checks out code with full git history  
✅ Sets up Node.js, pnpm, Java, and Android SDK  
✅ Builds Next.js web assets  
✅ Syncs Capacitor with Android project  
✅ Builds APK using Gradle  
✅ Auto-versions using git commit count  
✅ Creates GitHub Release with APK  
✅ Uploads APK as artifact (90-day retention)  
✅ Calculates SHA256 checksum  
✅ Notifies that users can update  

## Setup Steps

### 1. Initial Setup (One-time)

The workflow file is already in place at:
```
.github/workflows/build-apk.yml
```

Just push to GitHub:
```bash
git add .github/workflows/build-apk.yml scripts/deploy-apk.sh
git commit -m "Add GitHub Actions CI/CD for automatic APK builds"
git push origin main
```

### 2. Configure Secrets (Optional)

If you want to automatically update the system config, add GitHub Secrets:

**Settings → Secrets and variables → Actions → New repository secret**

- `DATABASE_URL` - PostgreSQL connection string (optional)
- `API_TOKEN` - Admin API token (optional)
- `DEPLOY_SERVER_URL` - Custom deployment server (optional)

### 3. Manual Trigger (Optional)

You can manually trigger the workflow without pushing code:

**Actions tab → Build and Release APK → Run workflow**

## Workflow Details

### Trigger Events
- ✅ Every push to `main` branch
- ✅ Manual trigger via GitHub Actions UI (workflow_dispatch)

### Build Steps

```
1. Checkout code (with full git history for version counting)
2. Setup Node.js 18 + pnpm
3. Setup Java 17 + Android SDK
4. Calculate version:
   - VERSION_CODE = git commit count
   - VERSION_NAME = 1.0.{CODE}-{COMMIT_HASH}
5. Install dependencies (pnpm install)
6. Build Next.js app (pnpm build)
7. Sync Capacitor to Android
8. Build APK with Gradle
9. Copy APK to public/downloads/
10. Calculate SHA256 checksum
11. Create GitHub Release
12. Upload artifact (90-day retention)
```

### Generated Artifacts

**GitHub Release**
- Located: Releases tab on GitHub
- Contains: APK file + release notes with SHA256
- Naming: `v1.0.XX-COMMITHASH`
- Auto-generated changelog

**APK Locations**
- Local: `public/downloads/fireslot-nepal-1.0.XX-COMMITHASH.apk`
- GitHub: Release page
- Artifacts: GitHub Actions artifacts (90 days)

### Version Numbering

Version follows pattern: `MAJOR.MINOR.PATCH-HASH`

```
1.0.0   - First build
1.0.1   - After 1st commit to main
1.0.86  - After 86 commits to main
1.0.86-129a789  - With git commit hash
```

Version code increments automatically with each new commit.

## User Update Flow

### Automatic (Best Case)
```
1. Developer pushes to main
2. GitHub Actions builds APK automatically
3. APK released on GitHub
4. Next time user opens app, in-app checker detects new version
5. User sees "Update Available" modal
6. User taps "Update Now"
7. APK downloads and installs
```

### With Admin Intervention (Current Step Needed)
```
1. GitHub Actions builds APK automatically
2. Admin goes to: Admin → Configuration → App Update Settings
3. Admin updates APP_LATEST_VERSION to new version
4. Admin clicks Save
5. Next user check triggers update prompt
```

### Manual Deployment
```
1. Download APK from GitHub Release
2. Share with users manually
3. Users manually install APK
```

## Automated Update Configuration (Optional)

To fully automate user updates without admin steps, create a webhook:

### Option 1: Webhook to Update System Config

Create an API endpoint that accepts webhook data and updates the config:

```typescript
// In apps/api, add webhook endpoint:
POST /webhooks/github/release

Body:
{
  "action": "released",
  "release": {
    "tag_name": "v1.0.86-129a789",
    "assets": [{"name": "fireslot-nepal-*.apk"}]
  }
}

Action: Extract version and update APP_LATEST_VERSION in system config
```

Then add to GitHub webhook (Settings → Webhooks):
- Payload URL: `https://your-api-domain.com/webhooks/github/release`
- Events: Releases
- Content type: application/json

### Option 2: Deploy Script with Token

Update the workflow to call deploy script:

```yaml
- name: Deploy APK
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    API_TOKEN: ${{ secrets.API_TOKEN }}
  run: |
    bash scripts/deploy-apk.sh \
      https://api.yourserver.com \
      ${{ secrets.API_TOKEN }} \
      ${{ steps.version.outputs.version_name }}
```

Requires: API_TOKEN secret configured in GitHub

## Troubleshooting

### Workflow Failed
1. Check: Actions tab → Build and Release APK
2. Look for red X on recent run
3. Click run → Scroll to failed step
4. Common issues:
   - Android SDK not installed (usually auto-fixed by setup-android@v3)
   - Java version mismatch (using 17, usually ok)
   - Gradle daemon issues (--no-daemon flag used)

### APK Not Showing in Releases
1. Ensure workflow succeeded (green checkmark)
2. Check Releases tab (right sidebar)
3. If missing, rerun workflow: Actions → Run workflow

### Version Not Updating
1. Verify git history: `git rev-list --count HEAD`
2. Check workflow output for version calculation
3. Ensure commit was pushed (not just local)

### Users Not Seeing Update
1. Check APP_LATEST_VERSION was updated in admin config
2. Verify new version is higher than current app version
3. Clear app cache: Settings → Apps → FireSlot Nepal → Clear Cache
4. Force update check: Close and reopen app
5. Check browser console for errors

## Testing Locally

### Simulate Workflow Locally

```bash
# Get commit count (this is VERSION_CODE)
git rev-list --count HEAD

# Get short commit hash
git rev-parse --short HEAD

# Build APK like CI does
pnpm --filter @fireslot/web build
pnpm --filter @fireslot/web build:apk

# Result: fireslot-nepal-1.0.XX-HASH.apk
```

### Manual Release

If you want to manually create a release without waiting for GitHub Actions:

```bash
# 1. Build locally
pnpm --filter @fireslot/web build:apk

# 2. Copy to downloads
mkdir -p public/downloads
cp apps/web/android/app/build/outputs/apk/debug/app-debug.apk \
   public/downloads/fireslot-nepal-1.0.XX-HASH.apk

# 3. Create GitHub release manually
# Go to: Releases → Draft a new release
# Tag: v1.0.XX-HASH
# Upload APK file
# Publish

# 4. Update admin config
# Admin → Configuration → App Update Settings
# APP_LATEST_VERSION = 1.0.XX-HASH
```

## File Locations

| File | Purpose |
|------|---------|
| `.github/workflows/build-apk.yml` | GitHub Actions workflow |
| `scripts/deploy-apk.sh` | Optional deployment script |
| `apps/web/scripts/build-apk.sh` | Local APK build script |
| `public/downloads/` | APK storage location |

## Environment Variables

The workflow uses these environment variables:

```yaml
JAVA_VERSION: "17"
ANDROID_API_LEVEL: "34"
ANDROID_BUILD_TOOLS_VERSION: "34.0.0"
```

Modify in workflow if you need different versions.

## Performance

Typical workflow execution time:
- Setup + Dependencies: ~2-3 minutes
- Build (Next.js + Gradle): ~3-5 minutes
- Release + Upload: ~1 minute
- **Total: ~6-9 minutes per build**

This is automated, so you don't wait. Just push and the APK is built in the background.

## Next Steps

1. **Push the workflow to GitHub**
   ```bash
   git push origin main
   ```

2. **Monitor first build**
   - Go to Actions tab
   - Watch the "Build and Release APK" workflow
   - Should take ~6-9 minutes

3. **Check the release**
   - Go to Releases tab
   - Download the APK from release page
   - Test on device

4. **Update admin config (manually)**
   - Admin → Configuration → App Update Settings
   - Set APP_LATEST_VERSION to new version
   - Users see update prompt

5. **Optional: Set up webhook for full automation**
   - Create API endpoint for webhook
   - Configure GitHub webhook
   - Full automation achieved!

## Rollback

If a build has issues:

1. Revert the commit: `git revert <commit-hash>`
2. Push to main
3. Workflow automatically builds with previous code
4. Release tag with "-reverted" suffix

## Monitoring

Monitor builds via:
- **GitHub Actions tab** - Real-time build logs
- **Releases tab** - Published APKs
- **Artifacts** - Temporary APK storage (90 days)

## Security Notes

- APK files are stored in GitHub Releases (public)
- SHA256 checksums provided for verification
- No credentials are logged
- Secrets never appear in logs or artifacts

## Support

If workflow fails:
1. Check the workflow logs (Actions tab)
2. Common fixes: Rerun workflow, clear cache, update dependencies
3. Manual APK build as fallback: `pnpm --filter @fireslot/web build:apk`

---

**Recap:** Every push to main → APK automatically built → Available on GitHub Releases → Users notified via in-app checker → Download + install = automatic updates!
