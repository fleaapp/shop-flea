#!/usr/bin/env bash
# Standalone wrapper for the iOS archive preparation script.
# Use this if `npm run ios:archive-ready` is unavailable because the local
# package.json is out of sync with the cloud repo.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found in $ROOT. Are you in the project directory?"
  exit 1
fi
if [ ! -f "capacitor.config.ts" ]; then
  echo "ERROR: capacitor.config.ts not found in $ROOT."
  exit 1
fi
if [ ! -f "scripts/prepare-ios-archive.mjs" ]; then
  echo "ERROR: scripts/prepare-ios-archive.mjs is missing. Run 'git pull' to sync the latest cloud changes."
  exit 1
fi

node scripts/prepare-ios-archive.mjs "$@"
