# 侧边栏和会话管理功能实现总结

## 实现日期
2025年10月12日

## 功能概述

本次更新为 Imagio 添加了完整的侧边栏系统，支持多会话管理和自动化工作流设置。

## 主要功能

### 1. 侧边栏系统
- **位置**: 应用左侧固定侧边栏
- **可折叠**: 通过切换按钮收起/展开侧边栏
- **双标签页**:
  - **Sessions**: 历史会话列表
  - **Settings**: 自动化设置面板

### 2. 会话管理 (Sessions)
- ✅ 创建新会话 (+ New Session按钮)
- ✅ 会话列表显示
  - 会话名称和时间戳
  - 图片文件名预览
  - 相对时间显示 (刚刚、X分钟前、X小时前等)
- ✅ 切换会话
  - 点击会话项切换到对应会话
  - 当前活动会话高亮显示
- ✅ 删除会话
  - 悬停时显示删除按钮
  - 删除前确认
  - 自动切换到其他会话
- ✅ 会话持久化
  - 使用 localStorage 保存所有会话数据
  - 应用重启后自动恢复会话

### 3. 自动化设置 (Settings)
提供四个自动化开关:

#### 3.1 Auto Optimize OCR
- **功能**: OCR识别完成后自动优化文本
- **说明**: 使用LLM清理和修正OCR错误

#### 3.2 Auto Generate Prompt
- **功能**: OCR文本准备好后自动生成图像生成prompt
- **说明**: 基于OCR文本和用户设置的风格自动优化prompt

#### 3.3 Auto Generate Image
- **功能**: prompt准备好后自动生成图像
- **说明**: 使用BFL API自动生成图像

#### 3.4 Auto Save Image
- **功能**: 图像生成后自动保存到磁盘
- **说明**: 无需手动点击保存按钮

### 4. 会话数据模型

每个会话包含以下数据:
```typescript
{
  id: string;                    // 唯一标识符
  name: string;                  // 会话名称
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  
  // 图片信息
  imagePath: string;             // 图片路径
  imagePreviewUrl: string | null; // 预览URL
  
  // OCR结果
  ocrText: string;               // 原始OCR文本
  optimizedOcrText: string;      // 优化后的OCR文本
  processedImageUrl: string | null; // 处理后的图片
  
  // Prompt优化
  imageStyle: string;            // 图像风格
  customDescription: string;     // 自定义描述
  optimizedPrompt: string;       // 优化后的prompt
  
  // 图像生成
  generatedImageUrl: string | null;       // 生成的图片本地URL
  generatedImageRemoteUrl: string | null; // 生成的图片远程URL
  aspectRatio: '1:1' | '16:9' | '9:16';  // 纵横比
  
  // 处理状态
  isProcessingOcr: boolean;      // 是否正在OCR
  isOptimizingText: boolean;     // 是否正在优化文本
  isOptimizingPrompt: boolean;   // 是否正在优化prompt
  isGeneratingImage: boolean;    // 是否正在生成图像
}
```

## 技术实现

### 核心文件

1. **类型定义**
   - `src/types/session.ts` - 会话和设置的TypeScript类型

2. **Hooks**
   - `src/hooks/useSessionManager.ts` - 会话管理逻辑
   - `src/hooks/useAutomation.ts` - 自动化处理逻辑 (待完善)

3. **组件**
   - `src/components/sidebar/Sidebar.tsx` - 侧边栏主组件
   - `src/components/sidebar/SessionList.tsx` - 会话列表
   - `src/components/sidebar/SettingsPanel.tsx` - 设置面板
   - `src/components/Sidebar.css` - 侧边栏样式

4. **主应用**
   - `src/App.tsx` - 集成侧边栏和会话管理
   - `src/App.css` - 更新布局适配侧边栏

### 状态管理

- **会话状态**: 使用 `useSessionManager` hook管理
- **持久化**: localStorage (keys: `imagio_sessions`, `imagio_active_session`, `imagio_settings`)
- **同步**: 使用 useEffect 自动同步当前会话状态

### UI/UX特性

1. **渐变设计**
   - 紫色渐变主题保持一致
   - 平滑的过渡动画
   - 悬停效果和交互反馈

2. **响应式布局**
   - 侧边栏宽度: 280px
   - 可折叠以节省空间
   - 主内容区自动调整 margin

3. **交互优化**
   - 会话项悬停时显示删除按钮
   - 切换开关带有平滑动画
   - 滚动条自定义样式

## 待实现功能

### 5. 多图片并发导入 (TODO)
虽然基础架构已准备好，但以下功能尚未完全实现:

- [ ] 修改文件选择器支持多选
- [ ] 实现 `createMultipleSessions` 的实际调用
- [ ] 图片队列管理
- [ ] OCR串行处理逻辑
- [ ] 进度指示器

**实现思路**:
```typescript
// 在 selectImage 函数中启用多选
const files = await open({
  multiple: true,  // 启用多选
  filters: [...]
});

// 批量创建会话
const sessionIds = createMultipleSessions(files);

// 使用 useAutomation hook 的队列功能
queueSessions(sessionIds, files);
```

### 其他改进建议

1. **会话搜索/过滤**
   - 按日期范围过滤
   - 按名称搜索
   - 按处理状态过滤

2. **会话导出/导入**
   - 导出会话数据为JSON
   - 导入历史会话
   - 批量导出图片

3. **会话重命名**
   - 点击会话名称编辑
   - 自动保存

4. **缩略图预览**
   - 在会话列表中显示图片缩略图
   - 悬停时预览大图

5. **快捷键支持**
   - Ctrl/Cmd + N: 新建会话
   - Ctrl/Cmd + W: 关闭当前会话
   - Ctrl/Cmd + Tab: 切换会话

## 使用说明

### 基本工作流

1. **启动应用** - 自动加载上次的会话
2. **导入图片** - 使用工具栏的 "Select Image" 或拖放
3. **自动处理** - 根据设置面板的开关自动执行后续步骤
4. **管理会话** - 在侧边栏的Sessions标签中查看和切换会话
5. **配置自动化** - 在侧边栏的Settings标签中调整自动化行为

### 自动化工作流示例

**场景1: 全自动模式**
- 开启所有4个自动化开关
- 导入图片后，自动完成: OCR → 优化文本 → 生成prompt → 生成图片 → 保存图片

**场景2: 半自动模式**
- 开启 Auto Optimize OCR 和 Auto Generate Prompt
- 手动点击 "Generate Image" 按钮生成图片
- 手动保存图片

**场景3: 手动模式**
- 关闭所有自动化开关
- 每一步都需要手动点击按钮执行

## 注意事项

1. **性能考虑**
   - 会话数据存储在 localStorage，建议定期清理旧会话
   - 大量会话可能影响加载速度

2. **数据安全**
   - 会话数据保存在浏览器本地存储
   - 清除浏览器数据会丢失会话历史
   - 建议重要数据及时导出(待实现)

3. **自动化限制**
   - 自动化功能依赖API可用性
   - API失败时不会自动重试
   - 建议先测试单个会话再开启全自动模式

## 测试建议

1. **基础功能测试**
   - [ ] 创建新会话
   - [ ] 切换会话
   - [ ] 删除会话
   - [ ] 折叠/展开侧边栏

2. **持久化测试**
   - [ ] 创建几个会话后关闭应用
   - [ ] 重新打开应用，验证会话已恢复
   - [ ] 验证设置已保存

3. **自动化测试**
   - [ ] 逐个测试每个自动化开关
   - [ ] 测试多个开关同时开启
   - [ ] 验证自动化流程的正确顺序

4. **边界情况测试**
   - [ ] 删除最后一个会话(应创建新会话)
   - [ ] 快速切换多个会话
   - [ ] 在处理过程中切换会话

## 技术债务

- `useAutomation` hook 未完全集成 (已创建但未使用)
- 多图片导入功能未实现
- 会话切换时状态同步可能需要优化
- 缺少错误处理和用户反馈机制

## 总结

本次更新成功实现了侧边栏和会话管理的核心功能，为Imagio提供了类似ChatGPT/Claude的多会话体验。自动化设置功能让用户可以根据需求定制工作流程。虽然多图片并发导入功能尚未完成，但架构已经准备就绪，后续实现会比较容易。
