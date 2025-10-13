#!/bin/bash

# 重启应用脚本

APP_NAME="Imagio"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCREENSHOTS_DIR="$PROJECT_ROOT/.test-screenshots"

echo "🔄 重启应用..."

# 杀死现有进程
echo "🛑 停止现有进程..."
pkill -f "tauri dev" || true
pkill -f "$APP_NAME" || true
sleep 2

# 重新启动
echo "🚀 启动应用..."
cd "$PROJECT_ROOT"
npm run tauri:dev > "$SCREENSHOTS_DIR/tauri-dev.log" 2>&1 &
TAURI_PID=$!

echo "✅ 应用已重启 (PID: $TAURI_PID)"
echo "⏳ 等待启动 (15秒)..."
sleep 15

if pgrep -f "$APP_NAME" > /dev/null; then
    echo "✅ 应用运行中"
else
    echo "❌ 应用启动失败"
    exit 1
fi
