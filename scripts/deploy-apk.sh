#!/bin/bash
# Deploy APK to downloads folder and update system config

set -e

API_URL="${1:-http://localhost:3001}"
ADMIN_TOKEN="${2:-}"
VERSION_NAME="${3:-}"

if [ -z "$VERSION_NAME" ]; then
  echo "❌ Version name required"
  echo "Usage: ./deploy-apk.sh <API_URL> <ADMIN_TOKEN> <VERSION_NAME>"
  exit 1
fi

APK_FILE="public/downloads/fireslot-nepal-${VERSION_NAME}.apk"

if [ ! -f "$APK_FILE" ]; then
  echo "❌ APK file not found: $APK_FILE"
  exit 1
fi

echo "📦 Deploying APK: $VERSION_NAME"
echo "📍 File: $APK_FILE"
echo "🔗 API URL: $API_URL"

# Calculate checksum
CHECKSUM=$(sha256sum "$APK_FILE" | cut -d' ' -f1)
echo "🔐 SHA256: $CHECKSUM"

# If admin token provided, update system config
if [ -n "$ADMIN_TOKEN" ]; then
  echo "⚙️ Updating system config..."
  
  curl -X PUT "${API_URL}/admin/config/APP_LATEST_VERSION" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"value\": \"${VERSION_NAME}\"}" \
    && echo "✅ System config updated" \
    || echo "⚠️ Failed to update system config"
else
  echo "⚠️ No admin token provided - skipping automatic config update"
  echo "📝 Manual step: Update APP_LATEST_VERSION in admin config to: $VERSION_NAME"
fi

echo ""
echo "✅ Deployment complete!"
echo "🎯 Users will see update prompt on next check"
echo "📝 Release: v${VERSION_NAME}"
