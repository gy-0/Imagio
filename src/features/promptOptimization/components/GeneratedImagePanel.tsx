import type { FC } from 'react';

interface GeneratedImagePanelProps {
  generatedImageUrl: string;
  isGenerating: boolean;
  generationStatus: string;
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
  onSaveGeneratedImage,
  onCopyGeneratedImage,
  onCopyGeneratedImageUrl,
  onClearGeneratedImage,
  hasRemoteImageUrl
}) => {
  // Don't show panel if no image and not generating
  if (!generatedImageUrl && !isGenerating) {
    return null;
  }

  // Determine if we should show the status message
  const showStatus = isGenerating || (generationStatus && !generationStatus.startsWith('Auto-saved'));
  const showAutoSaveHint = generatedImageUrl && generationStatus && generationStatus.startsWith('Auto-saved');

  return (
    <div className="result-card generated-image-panel">
      <div className="result-header">
        <h2>Generated Image</h2>
      </div>

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

