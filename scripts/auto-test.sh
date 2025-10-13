#!/bin/bash

# 自动化测试脚本 - Imagio
# 此脚本将自动启动应用、截图、分析并改进

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCREENSHOTS_DIR="$PROJECT_ROOT/.test-screenshots"
APP_NAME="Imagio"

# 创建截图目录
mkdir -p "$SCREENSHOTS_DIR"

echo "🚀 启动自动化测试系统..."
echo "📂 项目目录: $PROJECT_ROOT"
echo "📸 截图目录: $SCREENSHOTS_DIR"

# 清理旧截图
rm -f "$SCREENSHOTS_DIR"/*.png

# 启动 Tauri 开发服务器（后台运行）
echo ""
echo "🔧 启动 Tauri 应用..."
cd "$PROJECT_ROOT"

# 杀死之前的进程
pkill -f "tauri dev" || true
pkill -f "$APP_NAME" || true
sleep 2

# 启动应用（后台运行）
npm run tauri:dev > "$SCREENSHOTS_DIR/tauri-dev.log" 2>&1 &
TAURI_PID=$!

echo "✅ Tauri 进程 PID: $TAURI_PID"
echo "⏳ 等待应用启动 (15秒)..."
sleep 15

# 检查应用是否运行
if ! pgrep -f "$APP_NAME" > /dev/null; then
    echo "❌ 应用启动失败！查看日志:"
    tail -n 20 "$SCREENSHOTS_DIR/tauri-dev.log"
    exit 1
fi

echo "✅ 应用已启动"

# 截图函数
take_screenshot() {
    local name=$1
    local output="$SCREENSHOTS_DIR/${name}_$(date +%s).png"

    echo "📸 截图: $name"

    # 使用 screencapture 捕获整个屏幕
    # 或者使用窗口捕获（需要窗口 ID）
    screencapture -x "$output"

    echo "   保存到: $output"
    echo "$output"
}

# 获取应用窗口信息
get_window_info() {
    osascript <<EOF
tell application "System Events"
    tell process "$APP_NAME"
        try
            set windowList to every window
            if (count of windowList) > 0 then
                set firstWindow to item 1 of windowList
                return {name of firstWindow, position of firstWindow, size of firstWindow}
            end if
        end try
    end tell
end tell
return "No window found"
EOF
}

# 模拟点击（使用 AppleScript）
click_button() {
    local button_name=$1
    osascript <<EOF
tell application "System Events"
    tell process "$APP_NAME"
        try
            click button "$button_name" of window 1
            return "success"
        on error errMsg
            return "error: " & errMsg
        end try
    end tell
end tell
EOF
}

# 测试周期
echo ""
echo "🧪 开始自动化测试..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 第一次截图 - 初始状态
SCREENSHOT_1=$(take_screenshot "01-initial-state")

# 等待
sleep 2

# 第二次截图 - 等待后状态
SCREENSHOT_2=$(take_screenshot "02-after-wait")

# 输出窗口信息
echo ""
echo "🪟 窗口信息:"
get_window_info

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成"
echo ""
echo "📊 结果:"
echo "  - 截图数量: $(ls -1 "$SCREENSHOTS_DIR"/*.png 2>/dev/null | wc -l)"
echo "  - 截图目录: $SCREENSHOTS_DIR"
echo ""
echo "💡 下一步: 使用 Claude 分析截图"
echo ""
echo "🛑 保持应用运行，按 Ctrl+C 停止"

# 等待用户中断
wait $TAURI_PID
