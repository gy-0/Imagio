# 侧边栏和会话管理 - 快速入门

## 🎯 新功能一览

### 侧边栏 (Sidebar)
- 左侧固定侧边栏，可折叠
- 两个标签: **Sessions** 和 **Settings**

### Sessions 标签
- 查看所有历史会话
- 点击切换会话
- 创建新会话
- 删除不需要的会话

### Settings 标签
4个自动化开关:
- ⚡ **Auto Optimize OCR**: OCR后自动优化文本
- ⚡ **Auto Generate Prompt**: 自动生成图像prompt
- ⚡ **Auto Generate Image**: 自动生成图像
- ⚡ **Auto Save Image**: 自动保存图像

## 🚀 快速开始

### 1. 启动应用
```bash
npm run tauri:dev
```

### 2. 第一次使用

1. 应用启动后会自动创建一个初始会话
2. 点击侧边栏左上角的 **"+ New Session"** 创建新会话
3. 或直接导入图片，会自动关联到当前会话

### 3. 导入图片并处理

**方式1: 手动模式** (所有自动化开关关闭)
```
1. 导入图片 → 2. 点击 Perform OCR → 3. 点击 Optimize Text
→ 4. 点击 Optimize Prompt → 5. 点击 Generate Image → 6. 点击 Save
```

**方式2: 全自动模式** (所有自动化开关打开)
```
1. 导入图片 → 2. 坐下来喝杯咖啡 ☕
应用会自动完成: OCR → 优化 → 生成prompt → 生成图像 → 保存
```

### 4. 管理会话

- **查看历史**: 点击侧边栏 **Sessions** 标签
- **切换会话**: 点击任意会话项
- **删除会话**: 悬停在会话上，点击 **Delete** 按钮
- **折叠侧边栏**: 点击侧边栏右侧的 **←** 按钮

## 💡 使用技巧

### 推荐工作流

**对于批量处理图片:**
1. 打开 Settings 标签
2. 只开启 "Auto Optimize OCR"
3. 导入多张图片(每张创建一个会话)
4. OCR会自动完成，然后你可以手动检查和调整

**对于完全自动化:**
1. 确保API keys已配置 (LLM + BFL)
2. 开启所有4个自动化开关
3. 导入图片，等待完成
4. 检查生成结果

### 键盘快捷键

现有快捷键保持不变:
- `⌘O` / `Ctrl+O`: 打开图片
- `⌘⇧S` / `Ctrl+Shift+S`: 截图
- `⌘C` / `Ctrl+C`: 复制OCR文本
- `⌘S` / `Ctrl+S`: 保存OCR文本

## 🔧 配置说明

### API配置

**LLM API** (用于文本优化和prompt生成):
1. 点击工具栏的 **Advanced** 按钮
2. 配置:
   - API Base URL
   - API Key
   - Model Name

**BFL API** (用于图像生成):
1. 点击工具栏的 **Advanced** 按钮
2. 在 "Black Forest Labs API Key" 栏输入你的API key

### 本地配置文件

创建 `public/config.local.json`:
```json
{
  "llm": {
    "apiBaseUrl": "https://your-api-endpoint",
    "apiKey": "your-api-key",
    "modelName": "your-model"
  },
  "bfl": {
    "apiKey": "your-bfl-api-key"
  }
}
```

## 📊 会话数据存储

所有会话数据保存在浏览器的 localStorage:
- `imagio_sessions`: 所有会话数据
- `imagio_active_session`: 当前活动会话ID
- `imagio_settings`: 用户设置

**注意**: 清除浏览器数据会丢失所有会话历史!

## 🐛 已知问题

1. **多图片导入**: 目前只能一次导入一张图片
   - 临时方案: 手动多次导入
   
2. **会话切换**: 切换会话时需要等待状态完全同步
   - 建议等待处理完成后再切换

3. **自动保存**: 自动保存可能会弹出多次保存对话框
   - 可以暂时关闭 "Auto Save Image" 手动保存

## 🔜 即将推出

- [ ] 多图片同时导入
- [ ] 会话搜索和过滤
- [ ] 会话重命名
- [ ] 批量导出
- [ ] 缩略图预览

## 💬 反馈

如有问题或建议，请:
1. 查看 `SIDEBAR_IMPLEMENTATION.md` 了解技术细节
2. 检查控制台是否有错误信息
3. 提交 issue 或 PR

---

**享受使用 Imagio 的新会话管理功能! 🎉**
