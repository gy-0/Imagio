/**
 * 完全自动化的端到端测试系统
 * 自动打开浏览器、操作应用、截图、分析问题
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '../.test-screenshots');
const APP_URL = 'http://localhost:1420';
const TEST_TIMEOUT = 60000;

// 确保截图目录存在
async function ensureScreenshotsDir() {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  } catch (err) {
    // 目录已存在
  }
}

// 测试报告
class TestReport {
  constructor() {
    this.tests = [];
    this.startTime = Date.now();
  }

  add(name, status, details = '', screenshot = null) {
    this.tests.push({
      name,
      status, // 'pass', 'fail', 'skip'
      details,
      screenshot,
      timestamp: new Date().toISOString()
    });
  }

  summary() {
    const passed = this.tests.filter(t => t.status === 'pass').length;
    const failed = this.tests.filter(t => t.status === 'fail').length;
    const duration = Date.now() - this.startTime;

    return {
      total: this.tests.length,
      passed,
      failed,
      duration: `${(duration / 1000).toFixed(2)}s`,
      tests: this.tests
    };
  }

  print() {
    const summary = this.summary();
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试报告');
    console.log('='.repeat(60));
    console.log(`总计: ${summary.total} | ✅ 通过: ${summary.passed} | ❌ 失败: ${summary.failed}`);
    console.log(`⏱️  耗时: ${summary.duration}`);
    console.log('='.repeat(60));

    this.tests.forEach((test, index) => {
      const icon = test.status === 'pass' ? '✅' : '❌';
      console.log(`\n${index + 1}. ${icon} ${test.name}`);
      if (test.details) {
        console.log(`   详情: ${test.details}`);
      }
      if (test.screenshot) {
        console.log(`   截图: ${test.screenshot}`);
      }
    });

    console.log('\n' + '='.repeat(60));
  }

  async save() {
    const reportPath = path.join(SCREENSHOTS_DIR, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.summary(), null, 2));
    console.log(`\n📄 测试报告已保存: ${reportPath}`);
  }
}

// 主测试函数
async function runAutomatedTests() {
  console.log('🚀 启动完全自动化测试系统...\n');

  await ensureScreenshotsDir();
  const report = new TestReport();

  let browser;
  let page;

  try {
    // 启动浏览器
    console.log('🌐 启动 Puppeteer 浏览器...');
    browser = await puppeteer.launch({
      headless: false, // 显示浏览器窗口，方便观察
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();

    // 监听控制台输出
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.log(`❌ 浏览器错误: ${msg.text()}`);
      }
    });

    // 监听页面错误
    page.on('pageerror', error => {
      console.log(`❌ 页面错误: ${error.message}`);
      report.add('页面错误检测', 'fail', error.message);
    });

    // 测试 1: 加载应用主页
    console.log('\n📋 测试 1: 加载应用主页...');
    try {
      await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: TEST_TIMEOUT });
      const screenshotPath = path.join(SCREENSHOTS_DIR, '01-app-loaded.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const title = await page.title();
      report.add('加载应用主页', 'pass', `页面标题: ${title}`, screenshotPath);
      console.log(`   ✅ 成功加载，标题: ${title}`);
    } catch (error) {
      report.add('加载应用主页', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 等待 React 渲染完成
    await new Promise(r => setTimeout(r, 2000));

    // 测试 2: 检查核心元素是否存在
    console.log('\n📋 测试 2: 检查核心 UI 元素...');
    try {
      const elements = await page.evaluate(() => {
        return {
          title: document.querySelector('h1')?.textContent,
          toolbar: !!document.querySelector('.toolbar'),
          shortcuts: document.querySelector('.shortcuts-hint')?.textContent
        };
      });

      const screenshotPath = path.join(SCREENSHOTS_DIR, '02-ui-elements.png');
      await page.screenshot({ path: screenshotPath });

      if (elements.title) {
        report.add('检查 UI 元素', 'pass', JSON.stringify(elements), screenshotPath);
        console.log(`   ✅ 核心元素存在`);
        console.log(`   标题: ${elements.title}`);
      } else {
        report.add('检查 UI 元素', 'fail', '缺少核心元素');
        console.log(`   ❌ 缺少核心元素`);
      }
    } catch (error) {
      report.add('检查 UI 元素', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 测试 3: 测试健康检查 API
    console.log('\n📋 测试 3: 调用健康检查 API...');
    try {
      const healthCheck = await page.evaluate(async () => {
        const { invoke } = window.__TAURI__.core;
        return await invoke('health_check');
      });

      report.add('健康检查 API', 'pass', JSON.stringify(healthCheck));
      console.log(`   ✅ 健康检查通过`);
      console.log(`   状态: ${healthCheck.status}`);
      console.log(`   版本: ${healthCheck.version}`);
      console.log(`   功能: ${healthCheck.features.join(', ')}`);
    } catch (error) {
      report.add('健康检查 API', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 测试 4: 测试 OCR 自动化
    console.log('\n📋 测试 4: 运行 OCR 自动测试...');
    try {
      const ocrResult = await page.evaluate(async () => {
        const { invoke } = window.__TAURI__.core;
        return await invoke('run_automated_test', { testImagePath: null });
      });

      const screenshotPath = path.join(SCREENSHOTS_DIR, '04-ocr-test.png');
      await page.screenshot({ path: screenshotPath });

      if (ocrResult.success) {
        report.add('OCR 自动测试', 'pass',
          `耗时: ${ocrResult.processingTimeMs}ms, 文本长度: ${ocrResult.ocrText.length}`,
          screenshotPath
        );
        console.log(`   ✅ OCR 测试通过`);
        console.log(`   处理时间: ${ocrResult.processingTimeMs}ms`);
        console.log(`   识别文本: ${ocrResult.ocrText.slice(0, 50)}...`);
      } else {
        report.add('OCR 自动测试', 'fail', ocrResult.error, screenshotPath);
        console.log(`   ❌ OCR 测试失败: ${ocrResult.error}`);
      }
    } catch (error) {
      report.add('OCR 自动测试', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 测试 5: 测试按钮可点击性
    console.log('\n📋 测试 5: 检查按钮可点击性...');
    try {
      const buttons = await page.$$eval('button', btns =>
        btns.map(btn => ({
          text: btn.textContent?.trim(),
          disabled: btn.disabled,
          visible: btn.offsetParent !== null
        }))
      );

      const screenshotPath = path.join(SCREENSHOTS_DIR, '05-buttons.png');
      await page.screenshot({ path: screenshotPath });

      report.add('按钮可点击性', 'pass',
        `找到 ${buttons.length} 个按钮`,
        screenshotPath
      );
      console.log(`   ✅ 找到 ${buttons.length} 个按钮`);
      buttons.forEach((btn, i) => {
        console.log(`   ${i + 1}. "${btn.text}" - ${btn.disabled ? '禁用' : '启用'}`);
      });
    } catch (error) {
      report.add('按钮可点击性', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 测试 6: 打开测试控制台
    console.log('\n📋 测试 6: 打开测试控制台页面...');
    try {
      await page.goto(`${APP_URL}/test.html`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));

      const screenshotPath = path.join(SCREENSHOTS_DIR, '06-test-console.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const testConsoleTitle = await page.$eval('h1', el => el.textContent);
      report.add('测试控制台页面', 'pass', `标题: ${testConsoleTitle}`, screenshotPath);
      console.log(`   ✅ 测试控制台加载成功`);
      console.log(`   标题: ${testConsoleTitle}`);
    } catch (error) {
      report.add('测试控制台页面', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 测试 7: 运行测试控制台中的健康检查
    console.log('\n📋 测试 7: 在测试控制台中运行健康检查...');
    try {
      await page.waitForSelector('button', { timeout: 5000 });

      // 点击健康检查按钮
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const healthButton = buttons.find(btn => btn.textContent.includes('健康检查'));
        if (healthButton) healthButton.click();
      });

      await new Promise(r => setTimeout(r, 2000));

      const screenshotPath = path.join(SCREENSHOTS_DIR, '07-health-check-result.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const stats = await page.evaluate(() => {
        return {
          passed: document.getElementById('stat-passed')?.textContent,
          failed: document.getElementById('stat-failed')?.textContent,
          total: document.getElementById('stat-total')?.textContent
        };
      });

      report.add('控制台健康检查', 'pass', JSON.stringify(stats), screenshotPath);
      console.log(`   ✅ 健康检查执行成功`);
      console.log(`   统计: 通过=${stats.passed}, 失败=${stats.failed}, 总计=${stats.total}`);
    } catch (error) {
      report.add('控制台健康检查', 'fail', error.message);
      console.log(`   ❌ 失败: ${error.message}`);
    }

    // 最终截图
    const finalScreenshot = path.join(SCREENSHOTS_DIR, 'final-state.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`\n📸 最终状态截图: ${finalScreenshot}`);

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    report.add('测试执行', 'fail', error.message);
  } finally {
    // 生成报告
    report.print();
    await report.save();

    // 关闭浏览器
    if (browser) {
      console.log('\n🔒 关闭浏览器...');
      await browser.close();
    }

    console.log('\n✨ 自动化测试完成！');

    // 返回报告摘要
    const summary = report.summary();
    process.exit(summary.failed > 0 ? 1 : 0);
  }
}

// 运行测试
runAutomatedTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
