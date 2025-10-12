import { useEffect, useRef } from 'react';
import type { FC } from 'react';

interface OcrPreviewPanelProps {
  imagePreviewUrl: string;
  processedImageUrl: string;
}

export const OcrPreviewPanel: FC<OcrPreviewPanelProps> = ({ imagePreviewUrl, processedImageUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) {
      return;
    }

    const bottomGap = 32;

    const updateMaxHeight = () => {
      const rect = containerEl.getBoundingClientRect();
      const availableSpace = window.innerHeight - rect.top - bottomGap;

      if (availableSpace > 0) {
        containerEl.style.setProperty('--ocr-preview-max-height', `${availableSpace}px`);
        containerEl.style.height = `${availableSpace}px`;
      } else {
        containerEl.style.removeProperty('--ocr-preview-max-height');
        containerEl.style.removeProperty('height');
      }
    };

    const resizeObserver = new ResizeObserver(updateMaxHeight);
    resizeObserver.observe(containerEl);
    updateMaxHeight();

    window.addEventListener('resize', updateMaxHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateMaxHeight);
      containerEl.style.removeProperty('--ocr-preview-max-height');
      containerEl.style.removeProperty('height');
    };
  }, []);

  if (!imagePreviewUrl) {
    return null;
  }

  return (
    <div className="preview-section" data-ocr-preview ref={containerRef}>
      <h2 className="panel-title">Selected Image</h2>

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
