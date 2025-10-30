import type { FC, ChangeEvent, MouseEvent } from 'react';
import { useState, useEffect } from 'react';
import type { AutomationSettings } from '../hooks/useAutomationSettings';
import type { AppSession } from '../types/appSession';
import type { SortOption } from '../utils/sessionUtils';
import { ContextMenu } from './ContextMenu';

interface OverlaySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  automationSettings: AutomationSettings;
  onAutomationSettingChange: <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => void;
  onSelectAutoSaveDirectory: () => void;
  sessions: AppSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  sortBy: SortOption;
  onSortByChange: (sortBy: SortOption) => void;
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
  onDeleteSession,
  onOpenSettings,
  sortBy,
  onSortByChange
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200); // 匹配动画时长
  };

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>, sessionId: string) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      sessionId
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleDeleteSession = () => {
    if (contextMenu) {
      console.log('Deleting session:', contextMenu.sessionId); // Debug log
      onDeleteSession(contextMenu.sessionId);
    }
  };

  if (!isOpen && !isClosing) {
    return null;
  }

  return (
    <div className="overlay-sidebar-root">
      <div
        className={`overlay-sidebar-backdrop${isClosing ? ' closing' : ''}`}
        onClick={() => {
          if (!contextMenu) {
            handleClose();
          }
        }}
      />
      <aside className={`overlay-sidebar-panel${isClosing ? ' closing' : ''}`}>
        <div className="overlay-sidebar-header">
          <h2>Imagio</h2>
          <button className="overlay-close-btn" onClick={handleClose} aria-label="Close sidebar">
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
            <div className="overlay-section-header">
              <h3>History</h3>
              <select
                value={sortBy}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onSortByChange(e.target.value as SortOption)}
                className="overlay-sort-select"
              >
                <option value="updatedAt">Last Modified</option>
                <option value="createdAt">Date Added</option>
              </select>
            </div>
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
                  onContextMenu={(event) => handleContextMenu(event, session.id)}
                >
                  <div className="overlay-session-title">{session.title}</div>
                  <div className="overlay-session-meta">
                    {formatTimestamp(session.updatedAt)}
                  </div>
                  {(session.ocr.optimizedText || session.ocr.ocrText) && (
                    <div className="overlay-session-snippet">
                      {(session.ocr.optimizedText || session.ocr.ocrText).slice(0, 80)}
                      {(session.ocr.optimizedText || session.ocr.ocrText).length > 80 ? '…' : ''}
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
            onClick={() => {
              handleClose();
              setTimeout(onOpenSettings, 250);
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </aside>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onDelete={handleDeleteSession}
        />
      )}
    </div>
  );
};
