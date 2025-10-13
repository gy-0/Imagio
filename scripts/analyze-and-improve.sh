#!/bin/bash

# 分析和改进脚本
# 此脚本由 Claude 调用，用于获取最新截图路径

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCREENSHOTS_DIR="$PROJECT_ROOT/.test-screenshots"

# 获取最新的截图
get_latest_screenshot() {
    local pattern=$1
    ls -t "$SCREENSHOTS_DIR"/${pattern}*.png 2>/dev/null | head -1
}

# 输出所有截图
echo "📸 可用截图:"
ls -lht "$SCREENSHOTS_DIR"/*.png 2>/dev/null || echo "无截图"

echo ""
echo "📄 最新截图:"
get_latest_screenshot "01-initial-state"
get_latest_screenshot "02-after-wait"

# 检查应用日志
echo ""
echo "📋 应用日志 (最后20行):"
if [ -f "$SCREENSHOTS_DIR/tauri-dev.log" ]; then
    tail -n 20 "$SCREENSHOTS_DIR/tauri-dev.log"
else
    echo "无日志文件"
fi
