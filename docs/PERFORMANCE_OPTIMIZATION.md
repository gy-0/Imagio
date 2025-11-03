# 性能优化指南

本文档提供了Imagio应用的性能优化建议和最佳实践。

## 当前性能分析

### 重型Hooks
| Hook | 代码行数 | 主要性能问题 |
|------|--------|----------|
| useImageGeneration | 633 | 多个async操作，blob管理 |
| useOcrProcessing | 398 | 频繁的state更新，图片处理 |
| usePromptOptimization | 179 | API调用，文本处理 |

### 已实现的优化

1. **错误处理和恢复机制** ✅
   - 集中错误管理，避免错误传播
   - 用户友好的错误提示

2. **代码复用** ✅
   - base64ToBlob逻辑提取到utils
   - detectMimeTypeFromBytes辅助函数

3. **容器化组件** ✅
   - 分离容器逻辑和展示逻辑
   - 更小的组件职责

## 后续优化建议

### 短期（1-2周）

#### 1. 使用useMemo和useCallback优化App.tsx
```typescript
// 缓存大对象和回调函数
const memoizedSessions = useMemo(() => sessions, [sessions]);
const memoizedHandleSelectSession = useCallback(() => {...}, [dependencies]);
```

#### 2. 实现虚拟滚动
- 对于长会话列表，使用react-window或react-virtualized
- 只渲染可见的列表项

#### 3. 代码分割
```typescript
// 使用lazy加载大的feature模块
const OcrPanel = lazy(() => import('./features/ocr/components/OcrPreviewPanel'));
const GenerationPanel = lazy(() => import('./features/promptOptimization/components/GeneratedImagePanel'));
```

#### 4. Image优化
- 使用WebP格式（需要浏览器支持检测）
- 实现缩略图预览
- 压缩大型图片

### 中期（2-4周）

#### 1. 状态管理迁移
```typescript
// 从多个useState迁移到Zustand或Redux
import create from 'zustand';

const useAppStore = create((set) => ({
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  // 其他状态...
}));
```

#### 2. Worker线程处理
- 将图片处理逻辑移到Web Worker
- 避免阻塞主线程

```typescript
// image-processor.worker.ts
self.onmessage = (event) => {
  const processed = expensiveImageProcessing(event.data);
  self.postMessage(processed);
};
```

#### 3. 缓存优化
```typescript
// 使用MemoCache优化API调用结果
import { MemoCache } from './utils/memoization';

const apiCache = new MemoCache(10 * 60 * 1000); // 10分钟TTL

const getCachedResult = (key) => {
  if (apiCache.has(key)) {
    return apiCache.get(key);
  }
  // 调用API...
};
```

### 长期（1-2月）

#### 1. 性能监控
```typescript
// 使用Web Vitals监控应用性能
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getLCP(console.log);
```

#### 2. 增量渲染
- 实现React Suspense边界
- 优雅处理加载状态

#### 3. 数据库优化
- 实现会话数据的本地存储（IndexedDB）
- 后台同步机制

## 性能检查清单

- [ ] App.tsx中所有expensive计算都使用useMemo
- [ ] 所有回调都使用useCallback包装
- [ ] 列表组件都实现了虚拟滚动
- [ ] 大型模块都实现了code splitting
- [ ] 图片都经过优化和压缩
- [ ] 没有N+1查询问题
- [ ] 错误处理完善，无未捕获错误
- [ ] 单元测试覆盖率≥70%
- [ ] 构建体积≤500KB（gzip）
- [ ] 首屏加载时间≤3秒

## 性能指标目标

| 指标 | 目标 | 当前 |
|------|------|------|
| First Contentful Paint | < 1.5s | ? |
| Largest Contentful Paint | < 2.5s | ? |
| Cumulative Layout Shift | < 0.1 | ? |
| Time to Interactive | < 3s | ? |
| JS Bundle Size (gzip) | < 150KB | 123KB ✅ |

## 监控和测试

### 本地性能测试
```bash
# 使用Chrome DevTools Lighthouse
npm run build

# 使用Tauri分析
npm run tauri:build

# 运行性能测试
npm run test:performance
```

### 生产环境监控
- 集成Sentry进行错误监控
- 添加性能指标收集
- 用户会话重放（用于调试）

## 参考资源

- [React性能优化](https://react.dev/learn/render-and-commit)
- [Web Vitals](https://web.dev/vitals/)
- [Tauri性能最佳实践](https://tauri.app/v1/guides/features/system-tray/)
- [浏览器性能分析](https://developer.chrome.com/docs/devtools/performance/)

## 联系和支持

如有性能问题或建议，请创建Issue或提交PR。
