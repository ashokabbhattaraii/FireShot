# Auto-Update System: Quick Start Guide

## The Complete Flow (Now Automated! 🎉)

```
You push code to GitHub
    ↓
GitHub Actions triggers automatically
    ↓
Builds APK (6-9 minutes)
    ↓
Creates GitHub Release with APK
    ↓
APK available for download
    ↓
(Admin: Update APP_LATEST_VERSION in config)
    ↓
Next time users open app, they see "Update Available"
    ↓
Users tap "Update Now"
    ↓
APK downloads from GitHub
    ↓
Android system installs automatically
```

## 3 Steps to Enable Auto-Updates

### Step 1: Push CI/CD to GitHub (Right Now!)

```bash
cd /Users/ashokbhattarai/Desktop/Perosnal/Esports
git add .github/workflows/build-apk.yml scripts/deploy-apk.sh docs/GITHUB_ACTIONS_CI_CD.md
git commit -m "Add GitHub Actions CI/CD for automatic APK builds"
git push origin main
```

### Step 2: Watch First Automated Build

1. Go to your GitHub repo → **Actions** tab
2. Click **Build and Release APK** workflow
3. Watch it build (takes ~6-9 minutes)
4. When done → Check **Releases** tab for new APK

### Step 3: Test Update Flow

1. **Download APK from release** → Install on test device
2. **Go to Admin → Configuration → App Update Settings**
3. **Update APP_LATEST_VERSION** to the new version (e.g., `1.0.86-129a789`)
4. **Click Save**
5. **Open app on test device** → See "Update Available" modal
6. **Tap "Update Now"** → Downloads and installs new APK

✅ **Done!** Users can now auto-update!

## How It Works Going Forward

### Every Time You Push Code:
1. GitHub Actions **automatically builds APK**
2. New version **available on Releases page**
3. Admin **updates APP_LATEST_VERSION** in config
4. Users **see update notification** next time they open app

### What Gets Created:
- **GitHub Release** with APK file + changelog
- **APK artifact** (stored 90 days)
- **SHA256 checksum** for verification
- **Automatic version numbering** (1.0.XX-HASH)

## Key Files

| File | What it does |
|------|-------------|
| `.github/workflows/build-apk.yml` | GitHub Actions workflow (runs automatically) |
| `scripts/deploy-apk.sh` | Optional deployment script |
| `docs/GITHUB_ACTIONS_CI_CD.md` | Full documentation |
| `docs/IN_APP_UPDATE_CHECKER.md` | In-app update system |

## Command Reference

### View Recent Builds
```bash
# Go to GitHub Actions tab
# Or check releases: https://github.com/username/repo/releases
```

### Manual Trigger (Skip waiting for push)
```bash
# GitHub Actions tab → Run workflow manually
```

### Build APK Locally (for testing)
```bash
pnpm --filter @fireslot/web build:apk
# Output: public/downloads/fireslot-nepal-1.0.XX-HASH.apk
```

### Check Current Version
```bash
git rev-list --count HEAD  # Version code
git rev-parse --short HEAD # Commit hash
```

## Example Update Scenario

**Friday 3 PM:** You fix a critical bug and push to main
```bash
git add .
git commit -m "Fix critical payment processing bug"
git push origin main
```

**Friday 3:10 PM:** GitHub Actions starts building
- You don't need to do anything
- Workflow runs in background

**Friday 3:20 PM:** APK is ready
- Available on GitHub Releases
- Download link: `https://github.com/repo/releases/tag/v1.0.XX-HASH`

**Friday 3:25 PM:** Admin updates config
- Admin → Configuration → App Update Settings
- Update `APP_LATEST_VERSION` → Save
- Takes 30 seconds

**Friday 3:26 PM onwards:** Users see update
- Each user who opens app sees "Update Available"
- Users tap "Update Now"
- APK downloads and installs automatically

**By Friday evening:** All active users are updated! 🚀

## Troubleshooting

### "Workflow not running"
- Check that code was pushed to `main` branch
- Go to Actions tab and verify no syntax errors in `.github/workflows/build-apk.yml`
- Try manual trigger: Actions → Run workflow

### "APK not in Releases"
- Go to Actions tab → Find the build
- Click the failed step to see error logs
- Common: Android SDK setup (usually auto-fixes on retry)
- Try: Rerun workflow from Actions tab

### "Users not seeing update"
- Did you update `APP_LATEST_VERSION` in admin config?
- Is the version higher than current app version?
- Have users closed and reopened the app?
- Check browser console for errors (F12 → Console)

## Advanced Setup (Optional)

### Full Automation (No Admin Steps)

To eliminate the admin config update step, set up a webhook:

1. Create API endpoint: `POST /webhooks/github/release`
2. Endpoint extracts version and updates `APP_LATEST_VERSION`
3. Configure in GitHub: Settings → Webhooks
4. Payload URL: `https://your-api.com/webhooks/github/release`
5. Events: Releases

Result: **Every push → APK built → Users updated → Zero manual steps**

See `docs/GITHUB_ACTIONS_CI_CD.md` for detailed instructions.

## What's Included

✅ Automatic APK builds on every push  
✅ GitHub Releases with versioning  
✅ In-app update checker (already set up)  
✅ Beautiful update modal UI  
✅ Optional admin config update  
✅ SHA256 checksums for verification  
✅ 90-day artifact retention  
✅ Manual workflow trigger option  

## Summary

- **GitHub Actions** = Automatic APK builds ✅
- **In-App Update Checker** = Users see update prompts ✅
- **Admin Config** = Control which version is "latest" ✅
- **Users** = Download and install automatically ✅

You now have a **complete auto-update pipeline!** 🎉

Every push → APK built → Users updated

No more manual APK management!

---

**Next Action:** Run the 3 steps above (takes 5 minutes to set up, then automated forever!)
