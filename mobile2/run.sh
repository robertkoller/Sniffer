#!/usr/bin/env bash
# Build + run Sniffy in the iOS Simulator with no Xcode GUI.
# Requires: Xcode installed (for the toolchain/SDK). Usage: ./run.sh
set -euo pipefail

cd "$(dirname "$0")"

SCHEME="Sniffy"
BUNDLE_ID="com.sniffy.app"
# Pick the first available iPhone simulator (override with: DEVICE_NAME="iPhone 16 Pro" ./run.sh)
DEVICE_NAME="${DEVICE_NAME:-}"

if [ -z "$DEVICE_NAME" ]; then
  DEVICE_NAME=$(xcrun simctl list devices available | grep -oE "iPhone [0-9][0-9a-zA-Z ]*" | head -1 | xargs)
fi
echo "▸ Simulator: $DEVICE_NAME"

# Boot the simulator (ignore error if already booted) and open the Simulator app window.
UDID=$(xcrun simctl list devices available | grep -F "$DEVICE_NAME (" | head -1 | grep -oE "[0-9A-F]{8}-[0-9A-F-]+")
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator

echo "▸ Building…"
xcodebuild \
  -project Sniffy.xcodeproj \
  -scheme "$SCHEME" \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination "id=$UDID" \
  -derivedDataPath build \
  build | tail -1

APP_PATH="build/Build/Products/Debug-iphonesimulator/$SCHEME.app"
echo "▸ Installing $APP_PATH"
xcrun simctl install "$UDID" "$APP_PATH"

echo "▸ Launching $BUNDLE_ID"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
echo "✓ Running in the Simulator."
