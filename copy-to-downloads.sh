#!/bin/bash

# Build the application
npm run tauri build

# Copy the .app file to Downloads
cp -r src-tauri/target/release/bundle/macos/Imagio.app ~/Downloads/

echo "✅ Imagio.app has been copied to ~/Downloads/"
