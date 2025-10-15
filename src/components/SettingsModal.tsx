import { type FC, type ChangeEvent, useState } from 'react';
import type { LLMSettings } from '../features/promptOptimization/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  llmSettings: LLMSettings;
  onLLMSettingChange: <K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) => void;
  bflApiKey: string;
  onBflApiKeyChange: (value: string) => void;
}

export const SettingsModal: FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  llmSettings,
  onLLMSettingChange,
  bflApiKey,
  onBflApiKeyChange
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showBflApiKey, setShowBflApiKey] = useState(false);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-modal-root">
      <div className="settings-modal-backdrop" onClick={onClose} />
      <div className="settings-modal-dialog">
        <div className="settings-modal-header">
          <h2>LLM Settings</h2>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="settings-modal-content">
          <div className="settings-field">
            <label>
              API Base URL
              <input
                type="text"
                value={llmSettings.apiBaseUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('apiBaseUrl', event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </label>
          </div>

          <div className="settings-field">
            <label>
              API Key
              <div className="password-input-wrapper">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={llmSettings.apiKey}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('apiKey', event.target.value)}
                  placeholder="Enter API key"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </label>
          </div>

          <div className="settings-field">
            <label>
              Model Name
              <input
                type="text"
                value={llmSettings.modelName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('modelName', event.target.value)}
                placeholder="gpt-4o-mini"
              />
            </label>
          </div>

          <div className="settings-field">
            <label>
              <span className="field-label-row">
                Temperature
                <span className="slider-value-inline">{llmSettings.temperature.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={llmSettings.temperature}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('temperature', parseFloat(event.target.value))}
              />
            </label>
          </div>

          <div className="settings-field">
            <label>
              BFL API Key (for image generation)
              <div className="password-input-wrapper">
                <input
                  type={showBflApiKey ? "text" : "password"}
                  value={bflApiKey}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onBflApiKeyChange(event.target.value)}
                  placeholder="Enter BFL API key"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowBflApiKey(!showBflApiKey)}
                  aria-label={showBflApiKey ? "Hide BFL API key" : "Show BFL API key"}
                >
                  {showBflApiKey ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="settings-modal-footer">
          <button className="primary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
