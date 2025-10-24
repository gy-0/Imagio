# 键盘快捷键优化

## 优化概述

本次优化重点改进了 Imagio 的键盘快捷键系统，提升了代码质量、用户体验和可维护性。

## 主要改进

### 1. 代码结构优化 (`useKeyboardShortcuts.ts`)

#### 改进前
- 快捷键逻辑分散在事件处理函数中
- 没有统一的快捷键配置管理
- 缺少类型安全和文档说明
- 性能未优化（每次依赖变化都重新创建处理函数）

#### 改进后
```typescript
// 集中管理的快捷键配置
export const KEYBOARD_SHORTCUTS: Record<string, ShortcutConfig> = {
  selectImage: {
    key: 'o',
    ctrlOrCmd: true,
    description: 'Open image file',
    category: 'file',
  },
  // ... 更多快捷键
};
```

**优点：**
- ✅ 所有快捷键集中定义，易于管理
- ✅ 完整的 TypeScript 类型支持
- ✅ 按功能分类（file, edit, view, general）
- ✅ 自动生成文档和 UI 显示
- ✅ 使用 `useCallback` 减少不必要的重新渲染

### 2. 增强的快捷键功能

#### 新增功能
- **Escape 键支持**：关闭模态框和侧边栏
- **智能输入框检测**：在输入框中不拦截常规快捷键
- **文本选择感知**：复制时检测是否有文本选择
- **跨平台支持**：自动适配 Mac（⌘）和 Windows/Linux（Ctrl）

#### 完整快捷键列表

| 快捷键 | 功能 | 分类 |
|--------|------|------|
| ⌘/Ctrl + O | 打开图片文件 | File |
| ⌘/Ctrl + Shift + S | 截取屏幕 | File |
| ⌘/Ctrl + S | 保存 OCR 文本 | File |
| ⌘/Ctrl + Enter | 执行 OCR | Edit |
| ⌘/Ctrl + C | 复制 OCR 文本 | Edit |
| ⌘/Ctrl + A | 切换高级设置 | View |
| ⌘/Ctrl + , | 打开设置 | General |
| Escape | 关闭模态框/侧边栏 | General |

### 3. 设置界面优化 (`SettingsModal.tsx`)

#### 新增标签页系统
```typescript
const [activeTab, setActiveTab] = useState<'llm' | 'shortcuts'>('llm');
```

**功能：**
- **LLM Settings 标签**：原有的 LLM 配置
- **Keyboard Shortcuts 标签**：新增的快捷键参考页面

#### 快捷键展示UI
- 按类别分组显示（File, Edit, View, General）
- 美观的键盘按键样式（`<kbd>` 标签）
- 自动适配系统（显示 ⌘ 或 Ctrl）
- 响应式设计，支持亮色/暗色模式

### 4. CSS 样式增强 (`App.css`)

新增了以下样式类：

```css
/* 标签页导航 */
.settings-tabs
.settings-tab
.settings-tab.active

/* 快捷键显示 */
.shortcuts-content
.shortcuts-intro
.shortcuts-category
.shortcuts-category-title
.shortcuts-list
.shortcut-item
.shortcut-description
.shortcut-keys
.shortcuts-note
```

**特点：**
- ✨ 现代化的UI设计
- 🌓 完整的亮色/暗色模式支持
- 💅 平滑的过渡动画
- 🎨 与应用整体风格一致

### 5. 工具函数

#### `formatShortcutDisplay(config: ShortcutConfig): string`
自动将快捷键配置转换为用户友好的显示文本。

**示例：**
```typescript
// macOS: ⌘ + Shift + S
// Windows: Ctrl + Shift + S
formatShortcutDisplay(KEYBOARD_SHORTCUTS.takeScreenshot);
```

## 性能优化

### 1. 使用 `useCallback` 
```typescript
const handleKeyDown = useCallback(
  (event: KeyboardEvent) => {
    // ... 处理逻辑
  },
  [/* 依赖项 */]
);
```
**效果：** 避免每次渲染都重新创建事件处理函数

### 2. 使用 `useMemo`
```typescript
const shortcutsByCategory = useMemo(() => {
  // 分组逻辑
}, []);
```
**效果：** 缓存快捷键分类结果，避免重复计算

## 用户体验改进

### 1. 更直观的快捷键发现
- 用户现在可以在设置中查看所有可用快捷键
- 按功能分类，易于查找
- 清晰的描述说明

### 2. 更智能的交互
- 在输入框中不会意外触发快捷键
- Escape 键可以快速关闭弹窗
- 文本选择时不会覆盖原生复制功能

### 3. 跨平台一致性
- 自动检测操作系统
- 使用正确的修饰键符号（⌘ 或 Ctrl）
- 保持平台原生的使用习惯

## 代码质量提升

### 1. 类型安全
```typescript
interface ShortcutConfig {
  key: string;
  ctrlOrCmd: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'file' | 'edit' | 'view' | 'general';
}
```

### 2. 可维护性
- 配置驱动设计
- 单一职责原则
- 易于扩展新快捷键

### 3. 文档化
- 完整的 JSDoc 注释
- 清晰的代码结构
- 自动生成的用户文档

## 如何添加新快捷键

1. 在 `useKeyboardShortcuts.ts` 中添加配置：
```typescript
export const KEYBOARD_SHORTCUTS = {
  // ... 现有快捷键
  myNewShortcut: {
    key: 'n',
    ctrlOrCmd: true,
    description: 'Do something new',
    category: 'edit',
  },
};
```

2. 更新接口和处理逻辑：
```typescript
interface KeyboardShortcutHandlers {
  // ... 现有处理函数
  onMyNewAction: () => void;
}

// 在 handleKeyDown 中添加处理
if (matchesShortcut(KEYBOARD_SHORTCUTS.myNewShortcut)) {
  event.preventDefault();
  onMyNewAction();
  return;
}
```

3. 在 `App.tsx` 中传入处理函数：
```typescript
useKeyboardShortcuts({
  // ... 现有处理函数
  onMyNewAction: () => { /* 实现 */ },
  // ...
});
```

## 测试建议

### 功能测试
- [ ] 所有快捷键在正常情况下工作
- [ ] 在输入框中快捷键行为正确
- [ ] Escape 键正确关闭模态框
- [ ] 设置界面的快捷键列表完整显示

### 跨平台测试
- [ ] macOS 上显示 ⌘ 符号
- [ ] Windows/Linux 上显示 Ctrl 文本
- [ ] 所有快捷键在不同系统上都能正常工作

### UI/UX 测试
- [ ] 亮色模式下样式正确
- [ ] 暗色模式下样式正确
- [ ] 标签页切换流畅
- [ ] 快捷键按键样式美观

## 总结

本次优化全面提升了键盘快捷键系统的质量：

- 🏗️ **架构改进**：从分散的逻辑到集中的配置管理
- 🚀 **性能提升**：使用 React 优化 hooks 减少重渲染
- 🎨 **UI增强**：新增快捷键参考界面
- 📚 **文档完善**：代码即文档，易于维护
- 🔧 **可扩展性**：轻松添加新快捷键

这些改进不仅提升了当前的用户体验，也为未来的功能扩展奠定了坚实的基础。
