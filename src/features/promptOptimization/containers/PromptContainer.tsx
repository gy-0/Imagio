import { PromptGenerationPanel } from '../components/PromptGenerationPanel';
import { GeneratedImagePanel } from '../components/GeneratedImagePanel';

interface PromptContainerProps {
  // Prompt generation props
  imageStyle: string;
  aspectRatio: string;
  customDescription: string;
  optimizedPrompt: string;
  isOptimizing: boolean;
  llmError: string | null;
  ocrText: string;
  isGenerating: boolean;
  isGenerationLocked: boolean;

  // Generated image props
  generatedImageUrl: string;
  generationStatus: string | null;
  hasRemoteImageUrl: boolean;

  // Callbacks - Prompt
  onImageStyleChange: (style: string) => void;
  onAspectRatioChange: (ratio: string) => void;
  onCustomDescriptionChange: (desc: string) => void;
  onOptimizedPromptChange: (prompt: string) => void;
  onOptimize: () => void;
  onCopyPrompt: () => void;
  onGenerateImage: () => void;

  // Callbacks - Generated image
  onSaveGeneratedImage: () => void;
  onCopyGeneratedImage: () => void;
  onCopyGeneratedImageUrl: () => void;
  onClearGeneratedImage: () => void;
}

export const PromptContainer = ({
  imageStyle,
  aspectRatio,
  customDescription,
  optimizedPrompt,
  isOptimizing,
  llmError,
  ocrText,
  isGenerating,
  isGenerationLocked,
  generatedImageUrl,
  generationStatus,
  hasRemoteImageUrl,
  onImageStyleChange,
  onAspectRatioChange,
  onCustomDescriptionChange,
  onOptimizedPromptChange,
  onOptimize,
  onCopyPrompt,
  onGenerateImage,
  onSaveGeneratedImage,
  onCopyGeneratedImage,
  onCopyGeneratedImageUrl,
  onClearGeneratedImage,
}: PromptContainerProps) => {
  return (
    <>
      <div className="right-panel">
        <PromptGenerationPanel
          imageStyle={imageStyle}
          onImageStyleChange={onImageStyleChange}
          aspectRatio={aspectRatio}
          onAspectRatioChange={onAspectRatioChange}
          customDescription={customDescription}
          onCustomDescriptionChange={onCustomDescriptionChange}
          optimizedPrompt={optimizedPrompt}
          onOptimizedPromptChange={onOptimizedPromptChange}
          onOptimize={onOptimize}
          isOptimizing={isOptimizing}
          llmError={llmError ?? ''}
          isOptimizeDisabled={!ocrText.trim()}
          onCopyPrompt={onCopyPrompt}
          onGenerateImage={onGenerateImage}
          isGenerating={isGenerating}
          isGenerationLocked={isGenerationLocked}
        />
      </div>

      <div className="generated-panel">
        <GeneratedImagePanel
          generatedImageUrl={generatedImageUrl}
          isGenerating={isGenerating}
          generationStatus={generationStatus ?? ''}
          onSaveGeneratedImage={onSaveGeneratedImage}
          onCopyGeneratedImage={onCopyGeneratedImage}
          onCopyGeneratedImageUrl={onCopyGeneratedImageUrl}
          onClearGeneratedImage={onClearGeneratedImage}
          hasRemoteImageUrl={hasRemoteImageUrl}
        />
      </div>
    </>
  );
};
