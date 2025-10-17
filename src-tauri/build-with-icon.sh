#!/usr/bin/env bash

set -e  # Exit on error

echo "🚀 Building Imagio with Liquid Glass icon..."
echo ""

# Step 1: Generate Assets.car if Icon.icon has changed
if [ ! -f "resources/Assets.car" ] || [ "resources/Icon.icon" -nt "resources/Assets.car" ]; then
  echo "📦 Step 1: Generating Assets.car from Icon.icon..."
  ./generate-icon.sh
  echo ""
else
  echo "✓ Assets.car is up to date"
  echo ""
fi

# Step 2: Build the app
echo "🔨 Step 2: Building Tauri app..."
cd ..
npm run tauri build
cd src-tauri

# Step 3: Add CFBundleIconName to Info.plist
echo ""
echo "🎨 Step 3: Adding Liquid Glass support to Info.plist..."
./add-icon-name.sh target/release/bundle/macos/Imagio.app

echo ""
echo "✅ Build complete!"
echo "📍 App location: target/release/bundle/macos/Imagio.app"
echo ""
echo "To test the app:"
echo "  open target/release/bundle/macos/Imagio.app"
