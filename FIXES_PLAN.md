# Imagio 代码修复计划

**创建时间**: 2025-10-17
**修复人员**: Claude Code
**总问题数**: 14 个（临时文件清理已确认不需要修复）

---

## 🔴 Critical Priority - 必须立即修复

### ✅ 1. llmClient.ts - 修复超时机制失效
**文件**: `src/utils/llmClient.ts`
**行数**: 205-348, 388-511
**问题**: AbortController 创建但从未传递给 fetch，导致超时无法生效
**修复**:
- 将 controller.signal 传递给 tauriFetch
- 在流式和非流式请求中都应用
- 测试超时是否正确触发

**状态**: ⏳ 待修复

---

### ✅ 2. App.tsx - 修复 Session 恢复竞态条件
**文件**: `src/App.tsx`
**行数**: 607-641
**问题**: 使用固定 300ms 延迟等待状态同步，不可靠
**修复**:
- 移除 setTimeout 固定延迟
- 使用 Promise.all 等待所有 load 操作完成
- 在所有异步操作结束后再重置 suppress flags

**状态**: ⏳ 待修复

---

### ✅ 3. App.tsx - 修复映射表内存泄漏
**文件**: `src/App.tsx`
**行数**: 94, 169, 192, 308
**问题**: imagePathToSessionIdRef 映射表只在成功/失败时清理，异常情况下永不清理
**修复**:
- 添加最大容量限制（例如 100 条）
- 添加定期清理陈旧条目（例如 5 分钟前的）
- 在新 session 创建时清理旧条目
- 添加 useEffect cleanup

**状态**: ⏳ 待修复

---

### ✅ 4. lib.rs - 澄清临时文件清理注释
**文件**: `src-tauri/src/lib.rs`
**行数**: 971-972
**问题**: 注释与最近 commit 信息矛盾，容易误导
**修复**:
- 更新注释说明用户主动选择保留临时文件
- 添加磁盘空间监控的建议注释
- 保持清理功能禁用（用户确认）

**状态**: ⏳ 待修复

---

## 🟡 High Priority - 重要但不紧急

### ✅ 5. lib.rs - 修复截图 OCR 失败静默处理
**文件**: `src-tauri/src/lib.rs`
**行数**: 766-769
**问题**: unwrap_or 导致 OCR 失败时返回空字符串而非错误
**修复**:
- 改为正确传播错误
- 或返回包含错误信息的结构
- 让前端能显示失败原因

**状态**: ⏳ 待修复

---

### ✅ 6. App.tsx - 修复 useEffect 依赖项错误
**文件**: `src/App.tsx`
**行数**: 360, 390
**问题**: isRestoringSessionRef 是 ref 不应在依赖数组中
**修复**:
- 移除所有 ref 类型的依赖项
- 使用 ref.current 读取值（已经在做的）
- 添加 ESLint 注释说明为何跳过某些依赖

**状态**: ⏳ 待修复

---

### ✅ 7. useSessionStorage.ts - 增强 localStorage 配额管理
**文件**: `src/hooks/useSessionStorage.ts`
**行数**: 95-112
**问题**: 只有一次降级（50→25），没有字节大小计算
**修复**:
- 添加多级降级策略（50 → 25 → 10 → 5）
- 计算 JSON 字符串实际大小
- 优先删除最旧的 session
- 添加用户提示

**状态**: ⏳ 待修复

---

## 🟠 Medium Priority - 优化和改进

### ✅ 8. useOcrProcessing.ts - 移除固定延迟反模式
**文件**: `src/features/ocr/useOcrProcessing.ts`
**行数**: 214-218
**问题**: 用 100ms 延迟等待状态传播
**修复**:
- 移除 setTimeout
- 依赖回调机制（已经有 onOcrComplete）
- 确保所有状态更新在回调中完成

**状态**: ⏳ 待修复

---

### ✅ 9. useOcrProcessing.ts - 优化参数变化处理
**文件**: `src/features/ocr/useOcrProcessing.ts`
**行数**: 358-375
**问题**: params 变化时立即触发 OCR，可能过于频繁
**修复**:
- 增加去抖延迟到 1000ms（从 500ms）
- 优化依赖数组，移除 performOcrOnPath
- 添加 isProcessing 检查避免重复触发

**状态**: ⏳ 待修复

---

### ✅ 10. useImageGeneration.ts - 修复 Blob URL 跟踪时序
**文件**: `src/features/imageGeneration/useImageGeneration.ts`
**行数**: 338-343
**问题**: useEffect 可能在 URL 被覆盖后才运行
**修复**:
- 在 setGeneratedImageUrl 时立即添加到跟踪
- 或在 useEffect 中添加清理逻辑
- 确保所有路径都正确跟踪

**状态**: ⏳ 待修复

---

### ✅ 11. llmClient.ts - 加强 SSE 流解析鲁棒性
**文件**: `src/utils/llmClient.ts`
**行数**: 455-486
**问题**: 硬编码切片位置，错误处理过于宽松
**修复**:
- 使用 regex 或更灵活的解析
- 区分跳过的空行和真正的错误
- 记录解析失败但不静默跳过

**状态**: ⏳ 待修复

---

## 🟢 Low Priority - 可选改进

### ✅ 12. lib.rs - 改进 Otsu 算法浮点精度
**文件**: `src-tauri/src/lib.rs`
**行数**: 478-525
**问题**: 大图像累加可能产生精度误差
**修复**:
- 考虑使用 Kahan 求和算法
- 或使用更高精度的数值类型
- 添加溢出检查

**状态**: ⏳ 待修复

---

### ✅ 13. tauri.conf.json - 审查安全配置
**文件**: `src-tauri/tauri.conf.json`
**行数**: 24-56
**问题**: CSP 禁用，文件系统权限过宽
**修复**:
- 评估是否需要启用 CSP
- 评估是否可以限制 fs:write 到特定目录
- 文档化当前权限选择的理由

**状态**: ⏳ 待修复

---

### ✅ 14. App.tsx - 优化排序性能
**文件**: `src/App.tsx`
**行数**: 328-330
**问题**: sortBy 变化时需要全排序 O(n log n)
**修复**:
- 添加排序缓存
- 或使用稳定的排序标识符
- 考虑虚拟滚动

**状态**: ⏳ 待修复

---

## 📋 修复检查清单

- [x] 1. llmClient.ts 超时机制 ✅ Commit `715fb6b`
- [x] 2. App.tsx Session 恢复竞态 ✅ Commit `9a7632f`
- [x] 3. App.tsx 映射表泄漏 ✅ Commit `9ced21f`
- [x] 4. lib.rs 注释澄清 ✅ Commit `dc9dedb`
- [x] 5. lib.rs 截图错误处理 ✅ Commit `567116b`
- [x] 6. App.tsx useEffect 依赖 ✅ Commit `f45ed3e`
- [x] 7. useSessionStorage 配额管理 ✅ Commit `bcb54e4`
- [x] 8. useOcrProcessing 固定延迟 ✅ Commit `2f32d75`
- [x] 9. useOcrProcessing 参数处理 ✅ Commit `d772b31`
- [x] 10. useImageGeneration Blob 跟踪 ✅ Commit `f8b707f`
- [x] 11. llmClient SSE 解析 ✅ Commit `c7d118e`
- [x] 12. lib.rs Otsu 精度 ✅ Commit `52126ff`
- [x] 13. tauri.conf 安全配置 ✅ Commit `e5cfa26`
- [x] 14. App.tsx 排序性能 ✅ Commit `3f7ff2c`

---

## 🎯 修复目标

- **Critical 问题**: 4 个 → ✅ **0 个**
- **High 问题**: 3 个 → ✅ **0 个**
- **Medium 问题**: 4 个 → ✅ **0 个**
- **Low 问题**: 3 个 → ✅ **0 个**

**完成度**: ✅ **14/14 (100%)**

## ✅ 修复完成总结

**修复日期**: 2025-10-17
**总计**: 14 个问题全部修复
**Commits**: 14 次提交
**构建状态**: ✅ 通过 (无错误)

---

## 📝 注意事项

1. 每个修复完成后立即 git commit
2. Commit 格式: `fix: [简短描述] (FIXES_PLAN #N)`
3. 测试每个修复的功能是否正常
4. 临时文件清理保持禁用（用户确认有足够空间）
5. 修复完成后运行 `npm run build` 和 `npm run tauri:build` 测试

---

## 🔗 相关文件

- TypeScript 源码: `src/**/*.ts`, `src/**/*.tsx`
- Rust 源码: `src-tauri/src/lib.rs`
- 配置文件: `src-tauri/tauri.conf.json`
- 构建配置: `package.json`, `tsconfig.json`

---

**最后更新**: 2025-10-17
