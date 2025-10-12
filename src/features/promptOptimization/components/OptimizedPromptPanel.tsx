import type { ChangeEvent, FC } from 'react';
import { useEffect, useRef } from 'react';

interface OptimizedPromptPanelProps {
  optimizedPrompt: string;
  onOptimizedPromptChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  onCopyPrompt: () => void;
  onGenerateImage: () => Promise<void> | void;
  isGenerating: boolean;
  isOptimizing?: boolean;
  generationStatus: string;
  generationError: string;
  generatedImageUrl: string;
  onSaveGeneratedImage: () => Promise<void> | void;
  onCopyGeneratedImage: () => Promise<void> | void;
  onCopyGeneratedImageUrl: () => Promise<void> | void;
  onClearGeneratedImage: () => void;
  hasRemoteImageUrl: boolean;
}

export const OptimizedPromptPanel: FC<OptimizedPromptPanelProps> = ({
  optimizedPrompt,
  onOptimizedPromptChange,
  aspectRatio,
  onAspectRatioChange,
  onCopyPrompt,
  onGenerateImage,
  isGenerating,
  isOptimizing = false,
  generationStatus,
  generationError,
  generatedImageUrl,
  onSaveGeneratedImage,
  onCopyGeneratedImage,
  onCopyGeneratedImageUrl,
  onClearGeneratedImage,
  hasRemoteImageUrl
}) => {
  // Track if panel has ever shown content - stays visible once shown
  // Resets when component remounts (via key={ocrText} prop in parent)
  const hasShownContent = useRef(false);
  
  useEffect(() => {
    if (optimizedPrompt || isOptimizing) {
      hasShownContent.current = true;
    }
  }, [optimizedPrompt, isOptimizing]);
  
  // Hide panel initially until content appears
  if (!hasShownContent.current) {
    return null;
  }

  return (
    <div className="result-card optimized-prompt-card">
      <div className="result-header">
        <h2>Optimized Prompt</h2>
      </div>
      <div className="optimized-prompt-container">
        <div className="optimized-prompt-section">
          <textarea
            value={optimizedPrompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onOptimizedPromptChange(event.target.value)}
            placeholder="Optimized prompt will appear here..."
            className="optimized-prompt-area"
            disabled={isOptimizing}
          />
          <div className="prompt-actions">
            <div className="aspect-ratio-selector">
              <label>
                Aspect Ratio:
                <select
                  value={aspectRatio}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onAspectRatioChange(event.target.value)}
                  className="aspect-ratio-select"
                >
                  <option value="21:9">21:9 (Ultrawide)</option>
                  <option value="16:9">16:9 (Widescreen)</option>
                  <option value="4:3">4:3 (Standard)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="3:4">3:4 (Portrait)</option>
                  <option value="9:16">9:16 (Mobile)</option>
                  <option value="9:21">9:21 (Tall)</option>
                </select>
              </label>
            </div>
            <div className="button-group prompt-buttons">
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
          </div>
          {generationStatus && (
            <div className="llm-status success">
              {generationStatus}
            </div>
          )}
          {generationError && (
            <div className="llm-status error">
              {generationError}
            </div>
          )}
        </div>
      </div>
      <div className="generated-image-section">
        <h3>Generated Image</h3>
        <div className={`generated-image-container${generatedImageUrl ? ' has-image' : ''}`}>
          {isGenerating ? (
            <div className="generation-loading">
              <div className="spinner"></div>
              <p>{generationStatus}</p>
            </div>
          ) : generatedImageUrl ? (
            <img
              src={generatedImageUrl}
              alt="Generated"
              className="generated-image"
            />
          ) : (
            <div className="empty-state">
              <p>Generated image will appear here</p>
            </div>
          )}
        </div>
        {generatedImageUrl && (
          <div className="generated-image-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => { void onSaveGeneratedImage(); }}
              disabled={isGenerating}
            >
              💾 Save Image
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => { void onCopyGeneratedImage(); }}
              disabled={isGenerating}
            >
              📋 Copy Image
            </button>
            {hasRemoteImageUrl && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => { void onCopyGeneratedImageUrl(); }}
                disabled={isGenerating}
              >
                🔗 Copy Link
              </button>
            )}
            <button
              type="button"
              className="secondary-btn danger"
              onClick={onClearGeneratedImage}
              disabled={isGenerating}
            >
              🗑️ Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
