import type { FC, ChangeEvent } from 'react';
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
                placeholder="http://127.0.0.1:11434/v1"
              />
            </label>
          </div>

          <div className="settings-field">
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

          <div className="settings-field">
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

          <div className="settings-field">
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

          <div className="settings-field">
            <label>
              BFL API Key (for image generation)
              <input
                type="password"
                value={bflApiKey}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onBflApiKeyChange(event.target.value)}
                placeholder="Enter BFL API key"
              />
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
