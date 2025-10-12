import type { FC } from 'react';

interface OcrPreviewPanelProps {
  imagePreviewUrl: string;
  processedImageUrl: string;
}

export const OcrPreviewPanel: FC<OcrPreviewPanelProps> = ({ imagePreviewUrl, processedImageUrl }) => {
  if (!imagePreviewUrl) {
    return null;
  }

  return (
    <div className="preview-section">
      <h2>Selected Image</h2>

      <div className="images-vertical">
        <div className="image-block">
          <h3>Original</h3>
          <div className="image-container">
            <img src={imagePreviewUrl} alt="Original" className="preview-image" />
          </div>
        </div>

        {processedImageUrl && (
          <div className="image-block">
            <h3>Processed</h3>
            <div className="image-container">
              <img src={processedImageUrl} alt="Processed" className="preview-image" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
