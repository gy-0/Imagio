import type { ChangeEvent, FC } from 'react';

interface PromptSettingsPanelProps {
  imageStyle: string;
  onImageStyleChange: (value: string) => void;
  customDescription: string;
  onCustomDescriptionChange: (value: string) => void;
  onOptimize: () => Promise<void> | void;
  isOptimizing: boolean;
  llmStatus: string;
  llmError: string;
  isOptimizeDisabled: boolean;
}

export const PromptSettingsPanel: FC<PromptSettingsPanelProps> = ({
  imageStyle,
  onImageStyleChange,
  customDescription,
  onCustomDescriptionChange,
  onOptimize,
  isOptimizing,
  llmStatus,
  llmError,
  isOptimizeDisabled
}) => (
  <div className="result-card prompt-settings-card">
    <div className="result-header">
      <h2>Prompt Settings</h2>
    </div>

    <div className="prompt-control-group">
      <label>
        Image Style:
        <select
          value={imageStyle}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onImageStyleChange(event.target.value)}
          className="style-select"
        >
          <option value="realistic">Realistic</option>
          <option value="artistic">Artistic</option>
          <option value="anime">Anime</option>
          <option value="abstract">Abstract</option>
          <option value="photographic">Photographic</option>
          <option value="illustration">Illustration</option>
          <option value="3d-render">3D Render</option>
          <option value="watercolor">Watercolor</option>
          <option value="oil-painting">Oil Painting</option>
        </select>
      </label>
    </div>

    <div className="prompt-control-group">
      <label>
        Additional Description:
        <textarea
          value={customDescription}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onCustomDescriptionChange(event.target.value)}
          placeholder="Add custom description or modifications..."
          className="custom-description-area"
          rows={3}
        />
      </label>
    </div>

    <button
      onClick={() => { void onOptimize(); }}
      className="primary-btn optimize-btn"
      disabled={isOptimizing || isOptimizeDisabled}
    >
      {isOptimizing ? '⏳ Generating...' : '✨ Generate Prompt'}
    </button>

    {llmStatus && (
      <div className="llm-status success">
        {llmStatus}
      </div>
    )}

    {llmError && (
      <div className="llm-status error">
        {llmError}
      </div>
    )}
  </div>
);
