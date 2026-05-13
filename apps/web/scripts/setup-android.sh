#!/bin/bash
set -e
echo "Building Next.js static export..."
cd "$(dirname "$0")/.."
CAPACITOR_BUILD=true pnpm build
echo "Adding Android platform if not exists..."
pnpm exec cap add android 2>/dev/null || echo "Android already added"
echo "Syncing Capacitor..."
pnpm exec cap sync android
echo "Copying assets..."
pnpm exec cap copy android
echo "Done. Open Android Studio with: pnpm exec cap open android"
