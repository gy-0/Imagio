import React from 'react';
import type { AppSettings } from '../../types/session';
import '../Sidebar.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSetting,
}) => {
  return (
    <div className="settings-panel">
      <div className="settings-section">
        <h3 className="settings-section-title">⚡ Automation</h3>
        
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Auto Optimize OCR</div>
            <div className="settings-item-description">
              Automatically optimize OCR text after recognition
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoOptimizeOcr}
              onChange={(e) => onUpdateSetting('autoOptimizeOcr', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-item-label">Auto Generate Prompt</div>
            <div className="settings-item-description">
              Automatically generate image prompt after OCR
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoGeneratePrompt}
              onChange={(e) => onUpdateSetting('autoGeneratePrompt', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-item-label">Auto Generate Image</div>
            <div className="settings-item-description">
              Automatically generate image after prompt optimization
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoGenerateImage}
              onChange={(e) => onUpdateSetting('autoGenerateImage', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-item-label">Auto Save Image</div>
            <div className="settings-item-description">
              Automatically save generated images to disk
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoSaveImage}
              onChange={(e) => onUpdateSetting('autoSaveImage', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">ℹ️ Info</h3>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>
          <p>These automation settings control the workflow:</p>
          <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
            <li>OCR runs on each imported image</li>
            <li>Subsequent steps run based on settings</li>
            <li>Multiple images process sequentially for OCR</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
