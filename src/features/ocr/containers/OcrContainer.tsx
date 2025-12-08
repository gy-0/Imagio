import { OcrPreviewPanel } from '../components/OcrPreviewPanel';
import { OcrTextPanel } from '../components/OcrTextPanel';

interface OcrContainerProps {
  // Preview panel props
  imagePreviewUrl: string;
  processedImageUrl: string;

  // Text panel props
  ocrText: string;
  optimizedText: string;
  isOptimizingText: boolean;
  textDisplayMode: 'original' | 'optimized';
  hasPerformedOcr: boolean;

  // Callbacks
  onOcrTextChange: (text: string) => void;
  onOptimizedTextChange: (text: string) => void;
  onCopy: () => void;
  onSave: () => void;
  onOptimize: () => void;
  onTextDisplayModeChange: (mode: 'original' | 'optimized') => void;
}

export const OcrContainer = ({
  imagePreviewUrl,
  processedImageUrl,
  ocrText,
  optimizedText,
  isOptimizingText,
  textDisplayMode,
  hasPerformedOcr,
  onOcrTextChange,
  onOptimizedTextChange,
  onCopy,
  onSave,
  onOptimize,
  onTextDisplayModeChange,
}: OcrContainerProps) => {
  return (
    <>
      <div className="left-panel">
        <OcrPreviewPanel
          imagePreviewUrl={imagePreviewUrl}
          processedImageUrl={processedImageUrl}
        />
      </div>

      <div className="middle-panel">
        {hasPerformedOcr && (
          <OcrTextPanel
            value={ocrText}
            onChange={onOcrTextChange}
            onCopy={onCopy}
            onSave={onSave}
            optimizedText={optimizedText}
            isOptimizing={isOptimizingText}
            onOptimize={onOptimize}
            textDisplayMode={textDisplayMode}
            onTextDisplayModeChange={onTextDisplayModeChange}
            onOptimizedTextChange={onOptimizedTextChange}
          />
        )}
      </div>
    </>
  );
};
