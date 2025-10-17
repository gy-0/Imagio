# Liquid Glass Icon Setup for macOS 26+

This document explains how to use the new macOS 26 Liquid Glass icons with Tauri.

## 📋 Prerequisites

### For Icon Generation (One-time Setup)

- **Xcode** (full version, not just Command Line Tools) - Only needed once to generate Assets.car
- Icon Composer (comes with Xcode) - For creating the .icon file

### For Building (Always Required)

- **Assets.car** file (already generated and committed to Git)
- Standard Tauri build tools (Node.js, Rust, etc.)

**Important**: Once you've generated `Assets.car`, you can commit it to Git. Future builds on machines without Xcode will still work!

## 🎨 Icon Files

- **Source**: `resources/Icon.icon` - Liquid Glass icon created with Icon Composer
- **Compiled**: `resources/Assets.car` - Compiled asset catalog (generated)

## 🔧 How It Works

### The New Icon Format

macOS 26 introduced a new `.icon` format that replaces the old `.icns` files. Key differences:

1. **Vector-based**: Contains vector graphics instead of rasterized images
2. **Effects included**: Supports translucency, specular lighting, blurring, and color tinting
3. **Multi-platform**: Same icon works across macOS, iOS, iPadOS, visionOS, etc.
4. **Compiled format**: `.icon` files must be compiled into `Assets.car` using `actool`

### Build Process

```
Icon.icon (vector + properties)
    ↓ (actool compile)
Assets.car (final asset catalog)
    ↓ (Tauri bundle)
App.app/Contents/Resources/Assets.car
```

## 🚀 Usage

### Quick Build (Recommended)

Use the all-in-one build script:

```bash
cd src-tauri
./build-with-icon.sh
```

This script will:
1. Generate `Assets.car` from `Icon.icon` (if needed)
2. Build the Tauri app
3. Add `CFBundleIconName` to the Info.plist

### Manual Steps

If you prefer to run each step manually:

#### 1. Generate Assets.car

After making changes to `resources/Icon.icon`:

```bash
cd src-tauri
./generate-icon.sh
```

This will:
- Compile `Icon.icon` into `Assets.car`
- Generate a fallback `Icon.icns` for older macOS
- Clean up temporary files

#### 2. Build the App

```bash
cd ..
npm run tauri build
```

Tauri will automatically:
- Copy `Assets.car` to `App.app/Contents/Resources/`
- Sign the asset catalog

#### 3. Add CFBundleIconName

```bash
cd src-tauri
./add-icon-name.sh target/release/bundle/macos/Imagio.app
```

This adds `CFBundleIconName: "Icon"` to the app's Info.plist, which tells macOS 26 to use the Liquid Glass icon from Assets.car

## 📝 Configuration

### tauri.conf.json

```json
{
  "bundle": {
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",    // Keep for older macOS versions!
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "26.0",
      "files": {
        "Resources/Assets.car": "resources/Assets.car"
      },
      "infoPlist": {
        "CFBundleIconName": "Icon"
      }
    }
  }
}
```

### Key Points

- **Keep .icns files**: Don't remove the old icon format - it's needed for macOS < 26
- **Icon name**: The `--app-icon Icon` in the script must match `CFBundleIconName`
- **Signing**: Assets.car must be signed (Tauri handles this automatically)

## 🔍 Troubleshooting

### actool requires Xcode error

```bash
xcode-select: error: tool 'actool' requires Xcode
```

**Solution**: Install the full Xcode app from the Mac App Store, not just Command Line Tools.

### Icon not showing after build

1. Check that `Assets.car` exists in `src-tauri/resources/`
2. Verify `CFBundleIconName` matches the icon name in the script
3. Make sure the app bundle is properly signed
4. Try rebuilding from scratch: `npm run tauri build`

### Testing on older macOS versions

The app will fall back to `icon.icns` on macOS < 26, so keep both formats.

## 📚 References

- [Apple Icon Composer Documentation](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Tauri Issue #14207](https://github.com/tauri-apps/tauri/issues/14207)
- [Blog: Creating Liquid Glass Icons](https://www.zettlr.com/post/creating-macos-26-liquid-glass-icons)

## ⚙️ Technical Details

### actool Command

```bash
actool Icon.icon --compile ./resources \
  --output-format human-readable-text \
  --output-partial-info-plist assetcatalog_generated_info.plist \
  --app-icon Icon \
  --include-all-app-icons \
  --enable-on-demand-resources NO \
  --development-region en \
  --target-device mac \
  --minimum-deployment-target 26.0 \
  --platform macosx
```

### What Gets Bundled

```
App.app/
├── Contents/
│   ├── Info.plist (with CFBundleIconName: "Icon")
│   ├── Resources/
│   │   ├── Assets.car        ← New Liquid Glass icon
│   │   └── icon.icns         ← Legacy icon for older macOS
│   └── MacOS/
│       └── Imagio
```

## 🎯 Workflow Summary

1. Design icon in Icon Composer → Save as `Icon.icon`
2. Run `./generate-icon.sh` → Creates `Assets.car`
3. Run `npm run tauri build` → App with Liquid Glass icon! 🎉
