import type { FC } from 'react';
import { LoaderAnimation } from '../../../components/LoaderAnimation';

interface GeneratedImagePanelProps {
  generatedImageUrl: string;
  isGenerating: boolean;
  generationStatus: string;
  generationError: string;
  onSaveGeneratedImage: () => Promise<void> | void;
  onCopyGeneratedImage: () => Promise<void> | void;
  onCopyGeneratedImageUrl: () => Promise<void> | void;
  onClearGeneratedImage: () => void;
  hasRemoteImageUrl: boolean;
}

export const GeneratedImagePanel: FC<GeneratedImagePanelProps> = ({
  generatedImageUrl,
  isGenerating,
  generationStatus,
  generationError,
  onSaveGeneratedImage,
  onCopyGeneratedImage,
  onCopyGeneratedImageUrl,
  onClearGeneratedImage,
  hasRemoteImageUrl
}) => {
  // Always show the panel (no early return)

  // Determine if we should show the status message
  const showStatus = isGenerating || (generationStatus && !generationStatus.startsWith('Auto-saved'));
  const showAutoSaveHint = generatedImageUrl && generationStatus && generationStatus.startsWith('Auto-saved');

  return (
    <div className="result-card generated-image-panel">
      <div className="result-header">
        <h2 className="panel-title">Generated Image</h2>
      </div>

      <div className={`generated-image-container${generatedImageUrl ? ' has-image' : ''}`}>
        {isGenerating ? (
          <div className="generation-loading">
            <LoaderAnimation text="Generating" />
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

      {showAutoSaveHint && (
        <div className="auto-save-hint">
          {generationStatus}
        </div>
      )}

      {showStatus && !isGenerating && (
        <div className="generation-status-message">
          {generationStatus}
        </div>
      )}

      {generationError && (
        <div className="generation-error-message" role="alert">
          <strong>Image generation failed</strong>
          <span>{generationError}</span>
        </div>
      )}

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
  );
};
