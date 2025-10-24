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
  llmError: string;
  isOptimizeDisabled: boolean;
  onCopyPrompt: () => void;
  onGenerateImage: () => Promise<void> | void;
  isGenerating: boolean;
  isGenerationLocked: boolean;
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
  llmError,
  isOptimizeDisabled,
  onCopyPrompt,
  onGenerateImage,
  isGenerating,
  isGenerationLocked
}) => (
  <div className="result-card prompt-generation-card">
    <div className="result-header">
      <h2 className="panel-title">Prompt Generation</h2>
    </div>

    <div className="prompt-settings-section">
      <div className="prompt-select-row">
        <div className="prompt-control-group prompt-control-inline">
          <label>
            <span>Image Style:</span>
            <Select
              value={imageStyle}
              onChange={onImageStyleChange}
              className="compact-select"
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

        <div className="prompt-control-group prompt-control-inline">
          <label>
            <span>Aspect Ratio:</span>
            <Select
              value={aspectRatio}
              onChange={onAspectRatioChange}
              className="compact-select"
            >
              <option value="21:9">21:9 (Ultrawide)</option>
              <option value="16:9">16:9 (Widescreen)</option>
              <option value="4:3">4:3 (Standard)</option>
              <option value="5:4">5:4</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="4:5">4:5</option>
              <option value="3:4">3:4 (Portrait)</option>
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
              <option value="9:16">9:16 (Mobile)</option>
            </Select>
          </label>
        </div>
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
        {isOptimizing ? (
          <>
            ⏳ <span className="btn-shine">Generating</span>
          </>
        ) : (
          '✨ Generate Prompt'
        )}
      </button>

      {/* Hide success status to save space */}

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
          className="text-area-unified text-area-large"
          disabled={isOptimizing}
        />
      </label>
      <div className="button-group prompt-actions-bottom">
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
          disabled={isGenerationLocked || isOptimizing || !optimizedPrompt.trim()}
        >
          {isGenerating ? (
            <>
              ⏳ <span className="btn-shine">Generating</span>
            </>
          ) : (
            '🎨 Generate Image'
          )}
        </button>
      </div>

      {/* Generation status/errors removed from this panel */}
    </div>
  </div>
);
