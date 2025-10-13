// 自动化测试运行器 - 通过 Tauri API 测试应用功能
const { invoke } = window.__TAURI__.core;

async function runTests() {
  console.log('🚀 开始自动化测试...\n');

  // 测试 1: 健康检查
  console.log('📋 测试 1: 健康检查');
  try {
    const health = await invoke('health_check');
    console.log('✅ 健康检查通过:', health);
  } catch (error) {
    console.error('❌ 健康检查失败:', error);
  }

  // 测试 2: OCR 测试
  console.log('\n📋 测试 2: OCR 自动测试');
  try {
    const result = await invoke('run_automated_test', { testImagePath: null });
    if (result.success) {
      console.log(`✅ OCR 测试通过 (${result.processingTimeMs}ms)`);
      console.log('   识别文本:', result.ocrText.slice(0, 100));
    } else {
      console.log('❌ OCR 测试失败:', result.error);
    }
  } catch (error) {
    console.error('❌ OCR 测试异常:', error);
  }

  console.log('\n✨ 测试完成！');
}

// 执行测试
runTests();
