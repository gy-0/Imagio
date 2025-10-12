import { useCallback, useEffect, useRef, useState } from 'react';
import { DropOverlay } from './components/DropOverlay';
import { ProcessingStatus } from './components/ProcessingStatus';
import { Toolbar } from './components/toolbar/Toolbar';
import { Sidebar } from './components/sidebar/Sidebar';
import { useApplicationConfig } from './hooks/useApplicationConfig';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSessionManager } from './hooks/useSessionManager';
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

  // Session management
  const {
    sessionList,
    activeSessionId,
    activeSession,
    settings,
    createSession,
    selectSession,
    deleteSession,
    updateSession,
    updateSettings,
    // createMultipleSessions, // TODO: Implement multi-image import
  } = useSessionManager();

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

  // Sync session data when active session or states change
  useEffect(() => {
    if (!activeSessionId || !activeSession) return;

    updateSession(activeSessionId, {
      imagePath,
      imagePreviewUrl,
      processedImageUrl,
      ocrText,
      optimizedOcrText: optimizedText,
      imageStyle,
      customDescription,
      optimizedPrompt,
      generatedImageUrl,
      generatedImageRemoteUrl,
      aspectRatio: aspectRatio as '1:1' | '16:9' | '9:16',
      isProcessingOcr: isProcessing,
      isOptimizingText: isOptimizingText,
      isOptimizingPrompt: isOptimizing,
      isGeneratingImage: isGenerating,
    });
  }, [
    activeSessionId,
    activeSession,
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    optimizedText,
    imageStyle,
    customDescription,
    optimizedPrompt,
    generatedImageUrl,
    generatedImageRemoteUrl,
    aspectRatio,
    isProcessing,
    isOptimizingText,
    isOptimizing,
    isGenerating,
    updateSession,
  ]);

  // Handle automation based on settings
  useEffect(() => {
    if (!activeSessionId || !settings) return;

    // Auto-optimize OCR text when it changes
    if (settings.autoOptimizeOcr && ocrText && !isOptimizingText && !optimizedText) {
      void optimizeOcrText();
    }
  }, [activeSessionId, settings, ocrText, isOptimizingText, optimizedText, optimizeOcrText]);

  useEffect(() => {
    if (!activeSessionId || !settings) return;

    // Auto-generate prompt when OCR text is ready
    const textToUse = optimizedText || ocrText;
    if (settings.autoGeneratePrompt && textToUse && !isOptimizing && !optimizedPrompt) {
      void optimizePrompt();
    }
  }, [activeSessionId, settings, ocrText, optimizedText, isOptimizing, optimizedPrompt, optimizePrompt]);

  useEffect(() => {
    if (!activeSessionId || !settings) return;

    // Auto-generate image when prompt is ready
    if (settings.autoGenerateImage && optimizedPrompt && !isGenerating && !generatedImageUrl) {
      void generateImage(optimizedPrompt);
    }
  }, [activeSessionId, settings, optimizedPrompt, isGenerating, generatedImageUrl, generateImage]);

  useEffect(() => {
    if (!activeSessionId || !settings) return;

    // Auto-save image when generated
    if (settings.autoSaveImage && generatedImageUrl && !isGenerating) {
      void saveGeneratedImage();
    }
  }, [activeSessionId, settings, generatedImageUrl, isGenerating, saveGeneratedImage]);

  // Handle session creation
  const handleCreateSession = useCallback(() => {
    createSession();
  }, [createSession]);

  // Handle session selection
  const handleSelectSession = useCallback((sessionId: string) => {
    selectSession(sessionId);
    // Session data will be loaded from useSessionManager
  }, [selectSession]);

  // Handle session deletion
  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteSession(sessionId);
  }, [deleteSession]);

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
    <>
      <Sidebar
        sessions={sessionList}
        activeSessionId={activeSessionId}
        settings={settings}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onCreateSession={handleCreateSession}
        onUpdateSetting={updateSettings}
      />
      
      <div
        className={`container ${settings.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
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
    </>
  );
};

export default App;
