#!/usr/bin/env bash
ICON_PATH="./resources/Icon.icon"
OUTPUT_PATH="./resources"
PLIST_PATH="$OUTPUT_PATH/assetcatalog_generated_info.plist"
DEVELOPMENT_REGION="en"

# Use Xcode-beta's actool if available, otherwise use system actool
if [ -f "/Applications/Xcode-beta.app/Contents/Developer/usr/bin/actool" ]; then
  ACTOOL="/Applications/Xcode-beta.app/Contents/Developer/usr/bin/actool"
else
  ACTOOL="actool"
fi

echo "🎨 Generating Liquid Glass icon..."
echo "   Using: $ACTOOL"

$ACTOOL $ICON_PATH --compile $OUTPUT_PATH \
  --output-format human-readable-text --notices --warnings --errors \
  --output-partial-info-plist $PLIST_PATH \
  --app-icon Icon --include-all-app-icons \
  --enable-on-demand-resources NO \
  --development-region $DEVELOPMENT_REGION \
  --target-device mac \
  --minimum-deployment-target 26.0 \
  --platform macosx

# Remove the generated plist file as we don't need it
if [ -f "$PLIST_PATH" ]; then
  rm "$PLIST_PATH"
  echo "✓ Cleaned up temporary plist file"
fi

echo "✓ Assets.car generated successfully!"
echo "📦 Ready to build with: npm run tauri build"
