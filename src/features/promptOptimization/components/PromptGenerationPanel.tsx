import type { ChangeEvent, FC } from 'react';
import { Select } from '../../../components/Select';

interface PromptGenerationPanelProps {
  imageStyle: string;
  onImageStyleChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  customDescription: string;
  onCustomDescriptionChange: (value: string) => void;
  optimizedPrompt: string;
  onOptimizedPromptChange: (value: string) => void;
  onOptimize: () => Promise<void> | void;
  isOptimizing: boolean;
  llmStatus: string;
  llmError: string;
  isOptimizeDisabled: boolean;
  onCopyPrompt: () => void;
  onGenerateImage: () => Promise<void> | void;
  isGenerating: boolean;
}

export const PromptGenerationPanel: FC<PromptGenerationPanelProps> = ({
  imageStyle,
  onImageStyleChange,
  aspectRatio,
  onAspectRatioChange,
  customDescription,
  onCustomDescriptionChange,
  optimizedPrompt,
  onOptimizedPromptChange,
  onOptimize,
  isOptimizing,
  llmStatus,
  llmError,
  isOptimizeDisabled,
  onCopyPrompt,
  onGenerateImage,
  isGenerating
}) => (
  <div className="result-card prompt-generation-card">
    <div className="result-header">
      <h2 className="panel-title">Prompt Generation</h2>
    </div>

    <div className="prompt-settings-section">
      <div className="prompt-control-group">
        <label>
          Image Style:
          <Select
            value={imageStyle}
            onChange={onImageStyleChange}
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
          </Select>
        </label>
      </div>

      <div className="prompt-control-group">
        <label>
          Aspect Ratio:
          <Select
            value={aspectRatio}
            onChange={onAspectRatioChange}
          >
            <option value="21:9">21:9 (Ultrawide)</option>
            <option value="16:9">16:9 (Widescreen)</option>
            <option value="4:3">4:3 (Standard)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="3:4">3:4 (Portrait)</option>
            <option value="9:16">9:16 (Mobile)</option>
            <option value="9:21">9:21 (Tall)</option>
          </Select>
        </label>
      </div>

      <div className="prompt-control-group">
        <label>
          Additional Description:
          <textarea
            value={customDescription}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onCustomDescriptionChange(event.target.value)}
            placeholder="Add custom description or modifications..."
            className="text-area-unified text-area-small"
            rows={2}
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

    <div className="optimized-prompt-section">
      <label>
        Optimized Prompt:
        <textarea
          value={optimizedPrompt}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onOptimizedPromptChange(event.target.value)}
          placeholder="Optimized prompt will appear here..."
          className="text-area-unified text-area-medium"
          disabled={isOptimizing}
        />
      </label>

      <div className="prompt-actions">
        <button
          type="button"
          onClick={onCopyPrompt}
          className="secondary-btn"
        >
          📋 Copy
        </button>
        <button
          type="button"
          onClick={() => { void onGenerateImage(); }}
          className="primary-btn"
          disabled={isGenerating || !optimizedPrompt.trim()}
        >
          {isGenerating ? '⏳ Generating...' : '🎨 Generate Image'}
        </button>
      </div>

      {/* Generation status/errors removed from this panel */}
    </div>
  </div>
);
