import type { FC, ChangeEvent } from 'react';
import type { LLMSettings } from '../features/promptOptimization/types';
import type { AutomationSettings } from '../hooks/useAutomationSettings';
import type { AppSession } from '../types/appSession';

interface OverlaySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  llmSettings: LLMSettings;
  onLLMSettingChange: <K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) => void;
  bflApiKey: string;
  onBflApiKeyChange: (value: string) => void;
  automationSettings: AutomationSettings;
  onAutomationSettingChange: <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => void;
  onSelectAutoSaveDirectory: () => void;
  sessions: AppSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

const formatTimestamp = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
};

export const OverlaySidebar: FC<OverlaySidebarProps> = ({
  isOpen,
  onClose,
  llmSettings,
  onLLMSettingChange,
  bflApiKey,
  onBflApiKeyChange,
  automationSettings,
  onAutomationSettingChange,
  onSelectAutoSaveDirectory,
  sessions,
  activeSessionId,
  onSelectSession
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="overlay-sidebar-root">
      <div className="overlay-sidebar-backdrop" onClick={onClose} />
      <aside className="overlay-sidebar-panel">
        <div className="overlay-sidebar-header">
          <h2>Control Center</h2>
          <button className="overlay-close-btn" onClick={onClose} aria-label="Close sidebar">
            ✕
          </button>
        </div>

        <div className="overlay-section">
          <h3>LLM Settings</h3>
          <div className="overlay-field">
            <label>
              API Base URL
              <input
                type="text"
                value={llmSettings.apiBaseUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('apiBaseUrl', event.target.value)}
                placeholder="http://127.0.0.1:11434/v1"
              />
            </label>
          </div>
          <div className="overlay-field">
            <label>
              API Key
              <input
                type="password"
                value={llmSettings.apiKey}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('apiKey', event.target.value)}
                placeholder="Enter API key"
              />
            </label>
          </div>
          <div className="overlay-field">
            <label>
              Model Name
              <input
                type="text"
                value={llmSettings.modelName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('modelName', event.target.value)}
                placeholder="llama3.2"
              />
            </label>
          </div>
          <div className="overlay-field">
            <label>
              Temperature
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={llmSettings.temperature}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('temperature', parseFloat(event.target.value))}
              />
              <span className="slider-value">{llmSettings.temperature.toFixed(2)}</span>
            </label>
          </div>
          <div className="overlay-field">
            <label>
              BFL API Key
              <input
                type="password"
                value={bflApiKey}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onBflApiKeyChange(event.target.value)}
                placeholder="Enter BFL API key"
              />
            </label>
          </div>
        </div>

        <div className="overlay-section">
          <h3>Automation</h3>
          <div className="overlay-toggle">
            <label>
              <input
                type="checkbox"
                checked={automationSettings.autoOptimizeOcr}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoOptimizeOcr', event.target.checked)}
              />
              自动优化 OCR 结果
            </label>
          </div>
          <div className="overlay-toggle">
            <label>
              <input
                type="checkbox"
                checked={automationSettings.autoGeneratePrompt}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoGeneratePrompt', event.target.checked)}
              />
              自动生成图片 Prompt
            </label>
          </div>
          <div className="overlay-toggle">
            <label>
              <input
                type="checkbox"
                checked={automationSettings.autoGenerateImage}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoGenerateImage', event.target.checked)}
              />
              自动生成图片
            </label>
          </div>
          <div className="overlay-toggle">
            <label>
              <input
                type="checkbox"
                checked={automationSettings.autoSaveImage}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoSaveImage', event.target.checked)}
              />
              自动保存生成的图片
            </label>
          </div>
          <div className="overlay-field overlay-auto-save">
            <label>
              自动保存路径
              <input
                type="text"
                value={automationSettings.autoSaveDirectory}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoSaveDirectory', event.target.value)}
                placeholder="/Users/you/Pictures/Imagio"
              />
            </label>
            <button
              type="button"
              className="overlay-secondary-btn"
              onClick={onSelectAutoSaveDirectory}
            >
              选择目录
            </button>
          </div>
        </div>

        <div className="overlay-section">
          <h3>历史会话</h3>
          <div className="overlay-sessions">
            {sessions.length === 0 && (
              <div className="overlay-empty">暂无历史记录，导入图片后会自动创建。</div>
            )}
            {sessions.map(session => (
              <button
                key={session.id}
                type="button"
                className={`overlay-session-item${session.id === activeSessionId ? ' active' : ''}`}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="overlay-session-title">{session.title}</div>
                <div className="overlay-session-meta">
                  {formatTimestamp(session.updatedAt)}
                </div>
                {session.ocr.ocrText && (
                  <div className="overlay-session-snippet">
                    {session.ocr.ocrText.slice(0, 80)}
                    {session.ocr.ocrText.length > 80 ? '…' : ''}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};
