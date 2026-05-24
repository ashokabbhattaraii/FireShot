#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "No git repository detected. Skipping local CI/CD."
  exit 0
fi

STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMR)"
if [[ -z "$STAGED_FILES" ]]; then
  echo "No staged changes found. Skipping local CI/CD."
  exit 0
fi

if ! printf '%s\n' "$STAGED_FILES" | grep -Eq '^(apps/(api|web)/|packages/|public/downloads/|scripts/|turbo\.json$|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$)'; then
  echo "Staged changes do not touch the app or release pipeline. Skipping local CI/CD."
  exit 0
fi

echo "=== Local CI/CD: build + APK refresh ==="
echo "1) Building the monorepo..."
pnpm build

echo "2) Building the Android APK..."
pnpm --filter @fireslot/web build:apk

echo "3) Staging refreshed download artifacts..."
git add -A public/downloads apps/api/public/downloads

echo "4) Updated APK artifacts are staged for commit."
echo "=== Local CI/CD complete ==="
