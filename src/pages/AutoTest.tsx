import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface HealthCheckResult {
  status: string;
  timestamp: number;
  version: string;
  features: string[];
}

interface TestResult {
  success: boolean;
  ocrText: string;
  error?: string;
  processingTimeMs: number;
}

interface TestReport {
  timestamp: number;
  testName: string;
  status: 'passed' | 'failed' | 'running';
  details: string;
  duration?: number;
}

export const AutoTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [reports, setReports] = useState<TestReport[]>([]);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);

  const addReport = (report: TestReport) => {
    setReports(prev => [...prev, report]);
  };

  const checkHealth = async () => {
    const report: TestReport = {
      timestamp: Date.now(),
      testName: 'Health Check',
      status: 'running',
      details: 'Checking application health...'
    };
    addReport(report);

    try {
      const result = await invoke<HealthCheckResult>('health_check');
      setHealth(result);
      addReport({
        timestamp: Date.now(),
        testName: 'Health Check',
        status: 'passed',
        details: `App is ${result.status}, version ${result.version}, features: ${result.features.join(', ')}`
      });
    } catch (error) {
      addReport({
        timestamp: Date.now(),
        testName: 'Health Check',
        status: 'failed',
        details: `Error: ${error}`
      });
    }
  };

  const runOcrTest = async () => {
    const report: TestReport = {
      timestamp: Date.now(),
      testName: 'OCR Test',
      status: 'running',
      details: 'Running automated OCR test...'
    };
    addReport(report);

    try {
      const result = await invoke<TestResult>('run_automated_test', {
        testImagePath: null
      });

      if (result.success) {
        addReport({
          timestamp: Date.now(),
          testName: 'OCR Test',
          status: 'passed',
          details: `OCR completed in ${result.processingTimeMs}ms. Text: "${result.ocrText.slice(0, 100)}..."`,
          duration: result.processingTimeMs
        });
      } else {
        addReport({
          timestamp: Date.now(),
          testName: 'OCR Test',
          status: 'failed',
          details: `OCR failed: ${result.error}`,
          duration: result.processingTimeMs
        });
      }
    } catch (error) {
      addReport({
        timestamp: Date.now(),
        testName: 'OCR Test',
        status: 'failed',
        details: `Error invoking test: ${error}`
      });
    }
  };

  const runFullTestSuite = async () => {
    setIsRunning(true);
    setReports([]);

    await checkHealth();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await runOcrTest();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 更多测试可以在这里添加...

    setIsRunning(false);
  };

  useEffect(() => {
    // 页面加载时自动运行健康检查
    checkHealth();
  }, []);

  const passedTests = reports.filter(r => r.status === 'passed').length;
  const failedTests = reports.filter(r => r.status === 'failed').length;
  const runningTests = reports.filter(r => r.status === 'running').length;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🤖 自动化测试控制台</h1>

      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '5px' }}>
        <h3>应用状态</h3>
        {health ? (
          <div>
            <div>✅ 状态: {health.status}</div>
            <div>📦 版本: {health.version}</div>
            <div>⚙️ 功能: {health.features.join(', ')}</div>
          </div>
        ) : (
          <div>⏳ 加载中...</div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runFullTestSuite}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            background: isRunning ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            marginRight: '10px'
          }}
        >
          {isRunning ? '⏳ 测试运行中...' : '▶️ 运行完整测试'}
        </button>

        <button
          onClick={checkHealth}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            marginRight: '10px'
          }}
        >
          🏥 健康检查
        </button>

        <button
          onClick={runOcrTest}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            background: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          📝 OCR 测试
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', background: '#e9ecef', borderRadius: '5px' }}>
        <h3>测试统计</h3>
        <div>✅ 通过: {passedTests}</div>
        <div>❌ 失败: {failedTests}</div>
        <div>⏳ 运行中: {runningTests}</div>
        <div>📊 总计: {reports.length}</div>
      </div>

      <div>
        <h3>测试报告</h3>
        <div style={{
          maxHeight: '500px',
          overflow: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
          background: '#fff',
          borderRadius: '5px'
        }}>
          {reports.length === 0 ? (
            <div style={{ color: '#999' }}>暂无测试报告</div>
          ) : (
            reports.map((report, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '10px',
                  padding: '10px',
                  background: report.status === 'passed' ? '#d4edda' :
                             report.status === 'failed' ? '#f8d7da' :
                             '#fff3cd',
                  border: '1px solid ' + (
                    report.status === 'passed' ? '#c3e6cb' :
                    report.status === 'failed' ? '#f5c6cb' :
                    '#ffeaa7'
                  ),
                  borderRadius: '3px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {report.status === 'passed' ? '✅' :
                   report.status === 'failed' ? '❌' :
                   '⏳'} {report.testName}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {new Date(report.timestamp).toLocaleTimeString()}
                  {report.duration && ` - ${report.duration}ms`}
                </div>
                <div style={{ marginTop: '5px' }}>{report.details}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoTest;
