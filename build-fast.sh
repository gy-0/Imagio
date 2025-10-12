#!/bin/bash

# Fast build script with sccache
echo "🚀 Starting fast build with sccache..."

# Set sccache as rustc wrapper
export RUSTC_WRAPPER=sccache

# Clear sccache stats (optional)
echo "📊 Current sccache stats:"
sccache --show-stats

# Build with optimizations
echo "🔨 Building Tauri app..."
npm run tauri:build

# Show final sccache stats
echo "📊 Final sccache stats:"
sccache --show-stats

echo "✅ Build complete!"
