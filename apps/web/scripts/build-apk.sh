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

if [[ -f "$WEB_DIR/.env.capacitor" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$WEB_DIR/.env.capacitor"
  set +a
fi

for ANDROID_JAVA_HOME in \
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
  "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
  "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"; do
  if [[ -x "$ANDROID_JAVA_HOME/bin/java" ]]; then
    export JAVA_HOME="$ANDROID_JAVA_HOME"
    export PATH="$JAVA_HOME/bin:$PATH"
    break
  fi
done

pushd "$REPO_ROOT" >/dev/null

GIT_SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
# Commit count becomes the patch version. The Android versionCode leaves room for
# dirty rebuilds from the same commit, so users can install fresh local APKs.
APP_PATCH_VERSION="$(git rev-list --count HEAD 2>/dev/null || echo 1)"
BUILD_OFFSET="0000"
DIRTY_SUFFIX=""
if ! git diff --quiet --ignore-submodules -- 2>/dev/null || ! git diff --cached --quiet --ignore-submodules -- 2>/dev/null; then
  BUILD_STAMP="$(date -u +%Y%m%d%H%M)"
  BUILD_OFFSET="$(date -u +%H%M)"
  DIRTY_SUFFIX=".dirty.${BUILD_STAMP}"
fi
APP_VERSION_CODE="$((100000000 + (10#$APP_PATCH_VERSION * 10000) + 10#$BUILD_OFFSET))"
APP_VERSION_NAME="1.0.${APP_PATCH_VERSION}-${GIT_SHORT_SHA}${DIRTY_SUFFIX}"

APK_VARIANT="assembleDebug"
APK_SOURCE="$WEB_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ "$MODE" == "release" ]]; then
  APK_VARIANT="assembleRelease"
  APK_SOURCE="$WEB_DIR/android/app/build/outputs/apk/release/app-release-unsigned.apk"
fi

echo "=== FireSlot Nepal APK Build ($MODE) ==="
echo "Version name: $APP_VERSION_NAME"
echo "Version code: $APP_VERSION_CODE"
if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java: $("$JAVA_HOME/bin/java" -version 2>&1 | head -n 1)"
else
  echo "Java: $(java -version 2>&1 | head -n 1)"
fi

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

APK_SIZE="$(wc -c < "$APK_SOURCE" | tr -d ' ')"
APK_SHA256="$(shasum -a 256 "$APK_SOURCE" | awk '{print $1}')"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "3) Copying artifacts..."
mkdir -p "$REPO_ROOT/apps/api/public/downloads" "$REPO_ROOT/public/downloads"
cp "$APK_SOURCE" "$REPO_ROOT/apps/api/public/downloads/fireslot-nepal.apk"
cp "$APK_SOURCE" "$REPO_ROOT/apps/api/public/downloads/fireslot-nepal-${APP_VERSION_NAME}.apk"
cp "$APK_SOURCE" "$REPO_ROOT/public/downloads/fireslot-nepal.apk"
cp "$APK_SOURCE" "$REPO_ROOT/public/downloads/fireslot-nepal-${APP_VERSION_NAME}.apk"
for DOWNLOAD_DIR in "$REPO_ROOT/apps/api/public/downloads" "$REPO_ROOT/public/downloads"; do
  cat > "$DOWNLOAD_DIR/latest.json" <<JSON
{
  "version": "$APP_VERSION_NAME",
  "filename": "fireslot-nepal.apk",
  "versionedFilename": "fireslot-nepal-${APP_VERSION_NAME}.apk",
  "fileSizeBytes": $APK_SIZE,
  "sha256": "$APK_SHA256",
  "builtAt": "$BUILT_AT"
}
JSON
done

echo "APK copied:"
echo "- apps/api/public/downloads/fireslot-nepal.apk"
echo "- apps/api/public/downloads/fireslot-nepal-${APP_VERSION_NAME}.apk"
echo "- public/downloads/fireslot-nepal.apk"
echo "- public/downloads/fireslot-nepal-${APP_VERSION_NAME}.apk"
echo "- latest.json manifest updated"
echo "=== Build complete ==="

popd >/dev/null
