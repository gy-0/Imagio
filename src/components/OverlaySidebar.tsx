import type { FC, ChangeEvent } from 'react';
import type { AutomationSettings } from '../hooks/useAutomationSettings';
import type { AppSession } from '../types/appSession';

interface OverlaySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  automationSettings: AutomationSettings;
  onAutomationSettingChange: <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => void;
  onSelectAutoSaveDirectory: () => void;
  sessions: AppSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onOpenSettings: () => void;
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
  automationSettings,
  onAutomationSettingChange,
  onSelectAutoSaveDirectory,
  sessions,
  activeSessionId,
  onSelectSession,
  onOpenSettings
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="overlay-sidebar-root">
      <div className="overlay-sidebar-backdrop" onClick={onClose} />
      <aside className="overlay-sidebar-panel">
        <div className="overlay-sidebar-header">
          <h2>Imagio</h2>
          <button className="overlay-close-btn" onClick={onClose} aria-label="Close sidebar">
            ✕
          </button>
        </div>

        <div className="overlay-sidebar-content">
          <div className="overlay-section">
            <h3>Automation</h3>
            <div className="overlay-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={automationSettings.autoOptimizeOcr}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoOptimizeOcr', event.target.checked)}
                />
                Auto-optimize OCR results
              </label>
            </div>
            <div className="overlay-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={automationSettings.autoGeneratePrompt}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoGeneratePrompt', event.target.checked)}
                />
                Auto-generate image prompt
              </label>
            </div>
            <div className="overlay-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={automationSettings.autoGenerateImage}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoGenerateImage', event.target.checked)}
                />
                Auto-generate image
              </label>
            </div>
            <div className="overlay-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={automationSettings.autoSaveImage}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoSaveImage', event.target.checked)}
                />
                Auto-save generated images
              </label>
            </div>
            <div className="overlay-field">
              <label>
                <span className="overlay-field-label-inline">
                  <span className="overlay-field-title">Auto-save Directory</span>
                  <button
                    type="button"
                    className="overlay-secondary-btn overlay-inline-btn"
                    onClick={onSelectAutoSaveDirectory}
                  >
                    Select Directory
                  </button>
                </span>
                <input
                  type="text"
                  value={automationSettings.autoSaveDirectory}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onAutomationSettingChange('autoSaveDirectory', event.target.value)}
                  placeholder="/Users/you/Pictures/Imagio"
                />
              </label>
            </div>
          </div>

          <div className="overlay-section">
            <h3>History</h3>
            <div className="overlay-sessions">
              {sessions.length === 0 && (
                <div className="overlay-empty">No history yet. Sessions will be created when you import images.</div>
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
        </div>

        <div className="overlay-settings-section">
          <button
            type="button"
            className="overlay-settings-btn"
            onClick={onOpenSettings}
          >
            ⚙️ LLM Settings
          </button>
        </div>
      </aside>
    </div>
  );
};
