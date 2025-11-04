# 关于历史记录图片持久化的说明

## 图片类型和存储位置

### 1. Original Image (原始图片)
- **路径字段**: `session.ocr.imagePath`
- **存储位置**: 用户选择的原始文件位置（如 ~/Pictures, ~/Desktop等）
- **持久性**: ✅ **永久保存**，除非用户手动删除原文件

### 2. Processed Image (OCR处理后的图片)
- **路径字段**: `session.ocr.processedImageUrl`
- **存储位置**: 系统临时目录 `/tmp/imagio_processed_*.png` (macOS/Linux)
- **持久性**: ⚠️ **可能被清理**
  - macOS会定期清理/tmp目录
  - 第三方清理软件可能删除临时文件
  - 重启后临时文件可能丢失
- **解决方案**: 如果processed image丢失，可以重新执行OCR（点击"Perform OCR"按钮）

### 3. Generated Image (AI生成的图片)
- **路径字段**: `session.generation.generatedImageLocalPath`
- **存储位置**: 应用数据目录 `~/Library/Application Support/com.imagio.app/generated-images/`
- **持久性**: ✅ **永久保存**，直到用户删除session或手动清理

### 4. Screenshot Image (截图)
- **路径字段**: `session.ocr.imagePath`
- **存储位置**: 系统临时目录 `/tmp/imagio_screenshot_*.png`
- **持久性**: ⚠️ **可能被清理**（与Processed Image相同）

## LocalStorage配额优化

### 修复内容
1. ✅ 保留所有文件路径（imagePath, processedImageUrl, generatedImageLocalPath）
2. ✅ 仅清理runtime blob URLs（`blob:http://...`）
3. ✅ 确保generated image保存到持久化目录
4. ✅ 降低MAX_SESSIONS限制，避免超出配额

### 最佳实践
- 重要的generated images会自动保存到app data目录
- Session历史记录保留所有路径信息
- 如果图片不显示，检查原文件是否被移动/删除

## 调试方法

如果历史记录图片不显示：

```bash
# 1. 检查generated images目录
ls -lh ~/Library/Application\ Support/com.imagio.app/generated-images/

# 2. 检查临时文件（processed/screenshot）
ls -lh /tmp/imagio_*

# 3. 查看localStorage内容
# 在开发者工具Console中执行：
console.log(JSON.parse(localStorage.getItem('imagio-sessions')))
```

## 毕业论文建议

可以在论文中讨论：
1. **图片持久化策略** - 原始图片 vs 临时文件 vs 应用数据
2. **存储优化** - LocalStorage配额管理和降级策略
3. **用户体验** - 重要图片自动保存，临时图片按需重新生成
4. **系统集成** - 与操作系统临时文件管理的协调
