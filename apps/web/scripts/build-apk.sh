#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-debug}"
if [[ "$MODE" != "debug" && "$MODE" != "release" ]]; then
  echo "Usage: scripts/build-apk.sh [debug|release]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$WEB_DIR/../.." && pwd)"

pushd "$REPO_ROOT" >/dev/null

GIT_SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
# Commit count gives a monotonic integer compatible with Android versionCode.
APP_VERSION_CODE="$(git rev-list --count HEAD 2>/dev/null || echo 1)"
APP_VERSION_NAME="1.0.${APP_VERSION_CODE}-${GIT_SHORT_SHA}"

APK_VARIANT="assembleDebug"
APK_SOURCE="$WEB_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ "$MODE" == "release" ]]; then
  APK_VARIANT="assembleRelease"
  APK_SOURCE="$WEB_DIR/android/app/build/outputs/apk/release/app-release-unsigned.apk"
fi

echo "=== FireSlot Nepal APK Build ($MODE) ==="
echo "Version name: $APP_VERSION_NAME"
echo "Version code: $APP_VERSION_CODE"

echo "1) Syncing Capacitor Android project..."
pushd "$WEB_DIR" >/dev/null
pnpm exec cap sync android

echo "2) Building Android APK..."
pushd android >/dev/null
APP_VERSION_NAME="$APP_VERSION_NAME" APP_VERSION_CODE="$APP_VERSION_CODE" ./gradlew "$APK_VARIANT"
popd >/dev/null

if [[ ! -f "$APK_SOURCE" ]]; then
  echo "ERROR: APK not found at $APK_SOURCE"
  exit 1
fi

echo "3) Copying artifacts..."
mkdir -p "$REPO_ROOT/apps/api/public/downloads" "$REPO_ROOT/public/downloads"
cp "$APK_SOURCE" "$REPO_ROOT/apps/api/public/downloads/fireslot-nepal.apk"
cp "$APK_SOURCE" "$REPO_ROOT/public/downloads/fireslot-nepal.apk"
cp "$APK_SOURCE" "$REPO_ROOT/public/downloads/fireslot-nepal-${APP_VERSION_NAME}.apk"

echo "APK copied:"
echo "- apps/api/public/downloads/fireslot-nepal.apk"
echo "- public/downloads/fireslot-nepal.apk"
echo "- public/downloads/fireslot-nepal-${APP_VERSION_NAME}.apk"
echo "=== Build complete ==="

popd >/dev/null
