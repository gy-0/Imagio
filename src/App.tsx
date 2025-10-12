import { useCallback, useEffect, useRef, useState } from 'react';
import { DropOverlay } from './components/DropOverlay';
import { ProcessingStatus } from './components/ProcessingStatus';
import { Toolbar } from './components/toolbar/Toolbar';
import { useApplicationConfig } from './hooks/useApplicationConfig';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { AdvancedControls } from './features/ocr/components/AdvancedControls';
import { OcrPreviewPanel } from './features/ocr/components/OcrPreviewPanel';
import { OcrTextPanel } from './features/ocr/components/OcrTextPanel';
import { useOcrProcessing } from './features/ocr/useOcrProcessing';
import { useImageGeneration } from './features/imageGeneration/useImageGeneration';
import { PromptGenerationPanel } from './features/promptOptimization/components/PromptGenerationPanel';
import { GeneratedImagePanel } from './features/promptOptimization/components/GeneratedImagePanel';
import { usePromptOptimization } from './features/promptOptimization/usePromptOptimization';
import './App.css';

const App = () => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [hasPerformedOcr, setHasPerformedOcr] = useState<boolean>(false);

  const {
    llmSettings,
    updateLLMSetting,
    bflApiKey,
    setBflApiKey
  } = useApplicationConfig();

  const {
    aspectRatio,
    setAspectRatio,
    generatedImageUrl,
    generatedImageRemoteUrl,
    isGenerating,
    generationStatus,
    generateImage,
    saveGeneratedImage,
    copyGeneratedImageUrl,
    copyGeneratedImageToClipboard,
    clearGeneratedImage,
    resetGenerationState
  } = useImageGeneration({ bflApiKey });

  const {
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    updateOcrText,
    optimizedText,
    isOptimizingText,
    textDisplayMode,
    setTextDisplayMode,
    optimizeOcrText,
    isProcessing,
    processingStatus,
    params,
    updateParam,
    selectImage,
    takeScreenshot,
    performOCR,
    copyOcrText,
    saveOcrText,
    isDragging,
    dragAndDropHandlers
  } = useOcrProcessing({ llmSettings });

  const {
    imageStyle,
    customDescription,
    optimizedPrompt,
    isOptimizing,
    llmStatus,
    llmError,
    setImageStyle,
    setCustomDescription,
    setOptimizedPrompt,
    optimizePrompt,
    isLikelyLocalLLM
  } = usePromptOptimization(llmSettings, ocrText);

  // Track OCR state changes
  const previousOcrText = useRef<string>('');
  useEffect(() => {
    if (previousOcrText.current !== ocrText) {
      // OCR text changed - mark as performed if not empty
      if (ocrText) {
        setHasPerformedOcr(true);
      }
      
      // Reset dependent states when OCR text changes
      if (previousOcrText.current) {
        setOptimizedPrompt('');
        resetGenerationState();
      }
      
      previousOcrText.current = ocrText;
    }
  }, [ocrText, resetGenerationState, setOptimizedPrompt]);
  
  // Reset hasPerformedOcr when new image is selected (imagePath changes)
  const previousImagePath = useRef<string>('');
  useEffect(() => {
    if (previousImagePath.current !== imagePath) {
      if (imagePath !== previousImagePath.current && previousImagePath.current !== '') {
        setHasPerformedOcr(false);
      }
      previousImagePath.current = imagePath;
    }
  }, [imagePath]);

  const handleGenerateImage = useCallback(() => {
    void generateImage(optimizedPrompt);
  }, [generateImage, optimizedPrompt]);

  const handleCopyPrompt = () => {
    if (!optimizedPrompt.trim()) {
      return;
    }

    navigator.clipboard.writeText(optimizedPrompt).catch(error => {
      console.error('Failed to copy optimized prompt:', error);
    });
  };

  const handleLanguageChange = (language: string) => {
    updateParam('language', language);
  };

  const toggleAdvanced = () => setShowAdvanced(prev => !prev);

  const shouldShowGeneratedPanel = isGenerating || Boolean(generatedImageUrl);
  const gridClassName = `main-content-three-column${shouldShowGeneratedPanel ? ' has-generated' : ''}`;

  useKeyboardShortcuts({
    onSelectImage: () => { void selectImage(); },
    onTakeScreenshot: () => { void takeScreenshot(); },
    onPerformOcr: () => { void performOCR(); },
    onCopyText: () => { void copyOcrText(); },
    onSaveText: () => { void saveOcrText(); },
    onToggleAdvanced: toggleAdvanced,
    canPerformOcr: Boolean(imagePath),
    hasOcrText: Boolean(ocrText.trim())
  });

  return (
    <div
      className="container"
      {...dragAndDropHandlers}
    >
      <h1>Imagio - OCR Application</h1>

      <div className="shortcuts-hint">
        ⌨️ Shortcuts: <kbd>⌘O</kbd> Open | <kbd>⌘⇧S</kbd> Screenshot | <kbd>⌘C</kbd> Copy | <kbd>⌘S</kbd> Save
      </div>

      <DropOverlay isVisible={isDragging} />

      <Toolbar
        onSelectImage={() => { void selectImage(); }}
        onTakeScreenshot={() => { void takeScreenshot(); }}
        language={params.language}
        onLanguageChange={handleLanguageChange}
        showAdvanced={showAdvanced}
        onToggleAdvanced={toggleAdvanced}
      />

      {showAdvanced && (
        <AdvancedControls
          params={params}
          onParamChange={updateParam}
          llmSettings={llmSettings}
          onLLMSettingChange={updateLLMSetting}
          isLikelyLocalLLM={isLikelyLocalLLM}
          bflApiKey={bflApiKey}
          onBflApiKeyChange={setBflApiKey}
        />
      )}

      <ProcessingStatus isProcessing={isProcessing} statusMessage={processingStatus} />

      {imagePath && (
        <div className={gridClassName}>
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
                onChange={updateOcrText}
                onCopy={() => copyOcrText()}
                onSave={() => saveOcrText()}
                optimizedText={optimizedText}
                isOptimizing={isOptimizingText}
                onOptimize={optimizeOcrText}
                textDisplayMode={textDisplayMode}
                onTextDisplayModeChange={setTextDisplayMode}
              />
            )}
          </div>

          {hasPerformedOcr && (
            <>
              <div className="right-panel">
                <PromptGenerationPanel
                  imageStyle={imageStyle}
                  onImageStyleChange={setImageStyle}
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={setAspectRatio}
                  customDescription={customDescription}
                  onCustomDescriptionChange={setCustomDescription}
                  optimizedPrompt={optimizedPrompt}
                  onOptimizedPromptChange={setOptimizedPrompt}
                  onOptimize={optimizePrompt}
                  isOptimizing={isOptimizing}
                  llmStatus={llmStatus}
                  llmError={llmError}
                  isOptimizeDisabled={!ocrText.trim()}
                  onCopyPrompt={handleCopyPrompt}
                  onGenerateImage={handleGenerateImage}
                  isGenerating={isGenerating}
                />
              </div>

              {shouldShowGeneratedPanel && (
                <div className="generated-panel">
                  <GeneratedImagePanel
                    generatedImageUrl={generatedImageUrl}
                    isGenerating={isGenerating}
                    generationStatus={generationStatus}
                    onSaveGeneratedImage={() => saveGeneratedImage()}
                    onCopyGeneratedImage={() => copyGeneratedImageToClipboard()}
                    onCopyGeneratedImageUrl={() => copyGeneratedImageUrl()}
                    onClearGeneratedImage={clearGeneratedImage}
                    hasRemoteImageUrl={Boolean(generatedImageRemoteUrl)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
