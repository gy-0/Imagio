#!/usr/bin/env bash

# Add CFBundleIconName to the app's Info.plist for macOS 26 Liquid Glass support

APP_BUNDLE="$1"

if [ -z "$APP_BUNDLE" ]; then
  echo "Usage: $0 <path-to-app-bundle>"
  echo "Example: $0 target/release/bundle/macos/Imagio.app"
  exit 1
fi

INFO_PLIST="$APP_BUNDLE/Contents/Info.plist"

if [ ! -f "$INFO_PLIST" ]; then
  echo "❌ Info.plist not found at: $INFO_PLIST"
  exit 1
fi

# Check if CFBundleIconName already exists
if /usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$INFO_PLIST" 2>/dev/null; then
  echo "✓ CFBundleIconName already exists in Info.plist"
else
  # Add CFBundleIconName
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconName string Icon" "$INFO_PLIST"
  echo "✓ Added CFBundleIconName to Info.plist"
fi

echo "📦 App bundle is ready for macOS 26 Liquid Glass!"
