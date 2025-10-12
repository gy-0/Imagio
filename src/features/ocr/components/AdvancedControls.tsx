import type { ChangeEvent, FC } from 'react';
import type { ProcessingParams } from '../types';
import type { LLMSettings } from '../../promptOptimization/types';

interface AdvancedControlsProps {
  params: ProcessingParams;
  onParamChange: (key: keyof ProcessingParams, value: number | boolean | string) => void;
  llmSettings: LLMSettings;
  onLLMSettingChange: <K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) => void;
  isLikelyLocalLLM: boolean;
  bflApiKey: string;
  onBflApiKeyChange: (value: string) => void;
}

const Slider: FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; formatValue?: (value: number) => string; }> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue
}) => (
  <div className="control-group">
    <label>
      {label}: {formatValue ? formatValue(value) : value.toFixed(1)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(event.target.value))}
      />
    </label>
  </div>
);

const Checkbox: FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> = ({
  label,
  checked,
  onChange
}) => (
  <div className="control-group">
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      {label}
    </label>
  </div>
);

export const AdvancedControls: FC<AdvancedControlsProps> = ({
  params,
  onParamChange,
  llmSettings,
  onLLMSettingChange,
  isLikelyLocalLLM,
  bflApiKey,
  onBflApiKeyChange
}) => {
  return (
    <div className="advanced-controls">
      <h3>Advanced Processing</h3>

      <div className="controls-grid">
        <Slider
          label="Contrast"
          value={params.contrast}
          min={0.5}
          max={2.0}
          step={0.1}
          onChange={(value) => onParamChange('contrast', value)}
        />

        <Slider
          label="Brightness"
          value={params.brightness}
          min={-0.5}
          max={0.5}
          step={0.1}
          onChange={(value) => onParamChange('brightness', value)}
        />

        <Slider
          label="Sharpness"
          value={params.sharpness}
          min={0.5}
          max={2.0}
          step={0.1}
          onChange={(value) => onParamChange('sharpness', value)}
        />

        <Slider
          label="Gaussian Blur"
          value={params.gaussianBlur}
          min={0}
          max={5.0}
          step={0.5}
          onChange={(value) => onParamChange('gaussianBlur', value)}
        />

        <div className="control-group">
          <label>
            Morphology:
            <select
              value={params.morphology}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => onParamChange('morphology', event.target.value)}
            >
              <option value="none">None</option>
              <option value="erode">Erode (Thin)</option>
              <option value="dilate">Dilate (Thicken)</option>
            </select>
          </label>
        </div>

        <Checkbox
          label="CLAHE"
          checked={params.useClahe}
          onChange={(checked) => onParamChange('useClahe', checked)}
        />

        <Checkbox
          label="Bilateral Filter"
          checked={params.bilateralFilter}
          onChange={(checked) => onParamChange('bilateralFilter', checked)}
        />

        <Checkbox
          label="Adaptive Threshold"
          checked={params.useAdaptiveThreshold}
          onChange={(checked) => onParamChange('useAdaptiveThreshold', checked)}
        />
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>LLM Settings</h3>
      <div className="controls-grid">
        <div className="control-group">
          <label>
            API Base URL:
            <input
              type="text"
              value={llmSettings.apiBaseUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('apiBaseUrl', event.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            API Key:
            <input
              type="password"
              value={llmSettings.apiKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('apiKey', event.target.value)}
              placeholder="Enter your API key"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Model Name:
            <input
              type="text"
              value={llmSettings.modelName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onLLMSettingChange('modelName', event.target.value)}
              placeholder="llama3.1:8b"
            />
          </label>
        </div>

        <Slider
          label="Temperature"
          value={llmSettings.temperature}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(value) => onLLMSettingChange('temperature', value)}
          formatValue={(value) => value.toFixed(2)}
        />
      </div>

      <div className="control-group">
        <label>
          BFL API Key:
          <input
            type="password"
            value={bflApiKey}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onBflApiKeyChange(event.target.value)}
            placeholder="Enter your BFL API key"
          />
        </label>
      </div>

      {isLikelyLocalLLM ? (
        <div className="llm-hint">
          Local LLM detected (e.g., Ollama), API Key can be left empty.
        </div>
      ) : (
        <div className="llm-hint warning">
          When using a remote LLM, ensure API Key is filled in and securely stored.
        </div>
      )}
    </div>
  );
};
