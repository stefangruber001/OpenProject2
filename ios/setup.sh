#!/usr/bin/env bash
# One-shot setup for the Canei Subirats iOS app.
# Regenerates the Xcode project from project.yml and opens it.
#
# Usage:  cd ios && ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "▸ Canei Subirats iOS — setup"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "▸ XcodeGen not found."
  if command -v brew >/dev/null 2>&1; then
    echo "▸ Installing XcodeGen via Homebrew…"
    brew install xcodegen
  else
    echo "✗ Homebrew is not installed. Install it from https://brew.sh then re-run,"
    echo "  or simply double-click CaneiSubirats.xcodeproj — it already exists and"
    echo "  does not require XcodeGen."
    exit 1
  fi
fi

echo "▸ Generating CaneiSubirats.xcodeproj…"
xcodegen generate

echo "▸ Opening in Xcode…"
open CaneiSubirats.xcodeproj

echo "✓ Done. In Xcode: select your Team under Signing & Capabilities, then Run."
