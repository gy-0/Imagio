import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessingStatus } from './components/ProcessingStatus';
import { Toolbar } from './components/toolbar/Toolbar';
import { SidebarContainer } from './features/sidebar/containers/SidebarContainer';
import { SettingsContainer } from './features/settings/containers/SettingsContainer';
import { EmptyState } from './components/EmptyState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorNotification } from './components/ErrorNotification';
import { useErrorHandler } from './hooks/useErrorHandler';
import { useApplicationConfig } from './hooks/useApplicationConfig';
import { useAutomationSettings } from './hooks/useAutomationSettings';
import { useSessionManager } from './hooks/useSessionManager';
import { useAutomationFlow } from './hooks/useAutomationFlow';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSessionStateSync } from './hooks/useSessionStateSync';
import { OcrContainer } from './features/ocr/containers/OcrContainer';
import { PromptContainer } from './features/promptOptimization/containers/PromptContainer';
import { useOcrProcessing } from './features/ocr/useOcrProcessing';
import { useImageGeneration } from './features/imageGeneration/useImageGeneration';
import { usePromptOptimization } from './features/promptOptimization/usePromptOptimization';
import { updateSessionInPlace } from './utils/sessionUtils';
import { MAIN_GRID_CLASS } from './constants';
import './App.css';

const App = () => {
  const [hasPerformedOcr, setHasPerformedOcr] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [currentGenerationSessionId, setCurrentGenerationSessionId] = useState<string | null>(null);
  const [generatedImageOwnerSessionId, setGeneratedImageOwnerSessionId] = useState<string | null>(null);
  const suppressAutoProcessRef = useRef<boolean>(false);
  const suppressPromptResetRef = useRef<boolean>(false);
  const optimizeOcrTextRef = useRef<((textToOptimize?: string) => Promise<void>) | null>(null);
  const currentGenerationSessionIdRef = useRef<string | null>(null);

  const {
    llmSettings,
    updateLLMSetting,
    bflApiKey,
    setBflApiKey,
    geminiApiKey,
    setGeminiApiKey,
    bltcyApiKey,
    setBltcyApiKey,
    selectedModel,
    setSelectedModel
  } = useApplicationConfig();
  const {
    settings: automationSettings,
    updateSetting: updateAutomationSetting,
    isLoading: isAutomationLoading
  } = useAutomationSettings();

  // Error handling
  const { errors, clearError } = useErrorHandler();

  const {
    aspectRatio,
    setAspectRatio,
    generatedImageUrl,
    generatedImageRemoteUrl,
    generatedImageLocalPath,
    isGenerating,
    generationStatus,
    generateImage,
    saveGeneratedImage,
    copyGeneratedImageUrl,
    copyGeneratedImageToClipboard,
    clearGeneratedImage,
    saveGeneratedImageToDirectory,
    loadSessionSnapshot: loadGenerationSnapshot
  } = useImageGeneration({ bflApiKey, geminiApiKey, bltcyApiKey, selectedModel });

  // Define callback refs that will be initialized after useSessionManager
  const handleOcrCompleteRef = useRef<((details: { imagePath: string; ocrText: string; processedImageUrl: string; }) => void) | null>(null);
  const handleOptimizeCompleteRef = useRef<((details: { imagePath: string; optimizedText: string; }) => void) | null>(null);
  const handleOcrErrorRef = useRef<((details: { imagePath: string; error: string; }) => void) | null>(null);

  const {
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    updateOcrText,
    optimizedText,
    updateOptimizedText,
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
    loadSessionSnapshot: loadOcrSnapshot
  } = useOcrProcessing({
    llmSettings,
    suppressAutoProcessRef,
    onNewImage: (details) => {
      return onNewImageHandlerRef.current?.(details) ?? '';
    },
    onOcrComplete: (details) => handleOcrCompleteRef.current?.(details),
    onOcrError: (details) => handleOcrErrorRef.current?.(details),
    onOptimizeComplete: (details) => handleOptimizeCompleteRef.current?.(details)
  });

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
    loadSessionSnapshot: loadPromptSnapshot
  } = usePromptOptimization(llmSettings, ocrText, {
    suppressOcrResetRef: suppressPromptResetRef
  });

  // Session management
  const {
    sessions,
    setSessions,
    activeSessionId,
    sortBy,
    setSortBy,
    isSessionsLoading,
    isRestoringSessionRef,
    activeSessionIdRef,
    onNewImageHandlerRef,
    handleNewImage,
    handleSelectSession: sessionManagerSelectSession,
    handleDeleteSession: sessionManagerDeleteSession,
    updateSession,
    getSessionIdForImagePath,
    removeImagePathMapping
  } = useSessionManager({
    loadOcrSnapshot,
    loadPromptSnapshot,
    loadGenerationSnapshot,
    defaultOcrParams: params,
    defaultPromptState: {
      imageStyle,
      customDescription
    },
    defaultGenerationState: {
      aspectRatio
    }
  });

  useEffect(() => {
    optimizeOcrTextRef.current = optimizeOcrText;
  }, [optimizeOcrText]);

  // Use the session state sync hook to handle all session state synchronization
  useSessionStateSync({
    activeSessionId,
    isRestoringSession: isRestoringSessionRef.current,
    isSessionsLoading,
    sortBy,
    setSessions,
    ocrState: {
      imagePath,
      imagePreviewUrl,
      processedImageUrl,
      ocrText,
      optimizedText,
      textDisplayMode,
      params
    },
    isOptimizingText,
    promptState: {
      imageStyle,
      customDescription,
      optimizedPrompt
    },
    isOptimizing,
    generationState: {
      aspectRatio,
      generatedImageRemoteUrl,
      generatedImageLocalPath
    },
    isGenerating,
    currentGenerationSessionIdRef,
    setCurrentGenerationSessionId,
    setHasPerformedOcr,
    setOptimizedPrompt
  });

  const triggerImageGeneration = useCallback((prompt: string): boolean => {
    if (!activeSessionId) {
      return false;
    }

    if (!prompt.trim()) {
      return false;
    }

    if (isGenerating) {
      return false;
    }

    currentGenerationSessionIdRef.current = activeSessionId;
    setCurrentGenerationSessionId(activeSessionId);
    setGeneratedImageOwnerSessionId(activeSessionId);
    void generateImage(prompt);
    return true;
  }, [activeSessionId, generateImage, isGenerating, setGeneratedImageOwnerSessionId]);

  // Automation flow management
  const {
    resetAutomationTracking,
    resetConditionalTracking,
    shouldAutoOptimizeOcr,
    markOcrAsAutoOptimized,
    shouldAutoGeneratePromptAfterOcr,
    resetPromptTracking,
    triggerImageGenerationWithTracking
  } = useAutomationFlow({
    automationSettings,
    isAutomationLoading,
    ocrText,
    optimizedText,
    isOptimizingText,
    isOptimizing,
    optimizedPrompt,
    isGenerating,
    generatedImageUrl,
    isRestoringSession: isRestoringSessionRef.current,
    optimizeOcrText,
    optimizePrompt,
    triggerImageGeneration,
    saveGeneratedImageToDirectory
  });

  // Wrap handleNewImage to add additional state updates
  const wrappedHandleNewImage = useCallback((details: { path: string; previewUrl: string; source: 'file' | 'drop' | 'screenshot'; }) => {
    const sessionId = handleNewImage(details);
    setHasPerformedOcr(false);
    setGeneratedImageOwnerSessionId(sessionId);
    resetAutomationTracking();
    return sessionId;
  }, [handleNewImage, setGeneratedImageOwnerSessionId, resetAutomationTracking]);

  useEffect(() => {
    onNewImageHandlerRef.current = wrappedHandleNewImage;
  }, [wrappedHandleNewImage]);

  // Define OCR callback implementations
  const handleOcrComplete = useCallback((details: { imagePath: string; ocrText: string; processedImageUrl: string; }) => {
    // Find the session ID for this image path
    const sessionId = getSessionIdForImagePath(details.imagePath);
    if (!sessionId) {
      console.warn('No session found for image path:', details.imagePath);
      return;
    }

    // Use ref to get the latest activeSessionId to avoid stale closure values
    const currentActiveSessionId = activeSessionIdRef.current;

    // Update hasPerformedOcr if this is the active session
    if (sessionId === currentActiveSessionId) {
      setHasPerformedOcr(true);
    }

    // Update the session directly with OCR results
    // Keep the params from the session (including language setting)
    setSessions(prev => updateSessionInPlace(prev, sessionId, session => ({
      ...session,
      updatedAt: Date.now(),
      ocr: {
        ...session.ocr,
        processedImageUrl: details.processedImageUrl,
        ocrText: details.ocrText,
        // Clear optimizedText to prevent old content from persisting
        optimizedText: '',
        textDisplayMode: 'original' as const
        // params remains from session.ocr.params - no change needed
      }
    }), sortBy));

    // Auto-optimize: Only trigger for current active session to ensure state is correctly synchronized
    if (shouldAutoOptimizeOcr(sessionId, currentActiveSessionId, details.ocrText)) {
      // Mark this text as being optimized to prevent duplicate optimization
      markOcrAsAutoOptimized(details.ocrText);
      // Pass the OCR text directly to ensure we use the latest value
      void optimizeOcrTextRef.current?.(details.ocrText);
    }

    // Auto-generate prompt: If this is the current active session and auto-generate prompt is enabled
    if (shouldAutoGeneratePromptAfterOcr(sessionId, currentActiveSessionId, details.ocrText)) {
      // Reset the tracking to allow auto-generation for the new image
      resetPromptTracking();
    }

    // Clean up the mapping
    removeImagePathMapping(details.imagePath);
  }, [getSessionIdForImagePath, removeImagePathMapping, setSessions, sortBy, activeSessionIdRef, shouldAutoOptimizeOcr, markOcrAsAutoOptimized, shouldAutoGeneratePromptAfterOcr, resetPromptTracking]);

  const handleOptimizeComplete = useCallback((details: { imagePath: string; optimizedText: string; }) => {
    // Find the session for this image path
    const session = sessions.find(s => s.ocr.imagePath === details.imagePath);
    if (!session) return;

    updateSession(session.id, s => ({
      ...s,
      updatedAt: Date.now(),
      ocr: {
        ...s.ocr,
        optimizedText: details.optimizedText,
        textDisplayMode: 'optimized' as const
      }
    }));
  }, [sessions, updateSession]);

  const handleOcrError = useCallback((details: { imagePath: string; error: string; }) => {
    // Clean up the mapping to prevent memory leak
    removeImagePathMapping(details.imagePath);
    console.error('OCR processing failed:', details.error, 'for image:', details.imagePath);
  }, [removeImagePathMapping]);

  // Assign callbacks to refs
  useEffect(() => {
    handleOcrCompleteRef.current = handleOcrComplete;
  }, [handleOcrComplete]);

  useEffect(() => {
    handleOptimizeCompleteRef.current = handleOptimizeComplete;
  }, [handleOptimizeComplete]);

  useEffect(() => {
    handleOcrErrorRef.current = handleOcrError;
  }, [handleOcrError]);

  const handleGenerateImage = useCallback(() => {
    if (!optimizedPrompt.trim()) {
      return;
    }

    triggerImageGenerationWithTracking(optimizedPrompt);
  }, [optimizedPrompt, triggerImageGenerationWithTracking]);

  const handleCopyPrompt = () => {
    if (!optimizedPrompt.trim()) {
      return;
    }

    navigator.clipboard.writeText(optimizedPrompt).catch(error => {
      console.error('Failed to copy optimized prompt:', error);
    });
  };

  const handleClearGeneratedImage = useCallback(() => {
    if (isGenerating) {
      return;
    }

    clearGeneratedImage();
    if (activeSessionId) {
      setGeneratedImageOwnerSessionId(activeSessionId);
    } else {
      setGeneratedImageOwnerSessionId(null);
    }
  }, [activeSessionId, clearGeneratedImage, isGenerating, setGeneratedImageOwnerSessionId]);


  const handleLanguageChange = (language: string) => {
    updateParam('language', language);
  };

  const gridClassName = MAIN_GRID_CLASS;
  const isActiveSessionGenerating = isGenerating && currentGenerationSessionId === activeSessionId;
  const isGenerationLocked = isGenerating;
  const ownsGeneratedImage = generatedImageOwnerSessionId === activeSessionId;
  const activeGeneratedImageUrl = ownsGeneratedImage ? generatedImageUrl : '';
  const activeGeneratedImageRemoteUrl = ownsGeneratedImage ? generatedImageRemoteUrl : '';

  useKeyboardShortcuts({
    onSelectImage: () => { void selectImage(); },
    onTakeScreenshot: () => { void takeScreenshot(); },
    onPerformOcr: () => { void performOCR(); },
    onCopyText: () => { void copyOcrText(); },
    onSaveText: () => {
      // Prioritize saving generated image, then OCR text
      if (activeGeneratedImageUrl) {
        void saveGeneratedImage();
      } else if (ocrText.trim()) {
        void saveOcrText();
      }
    },
    onOpenSettings: () => setIsSettingsOpen(true),
    onCloseModal: () => {
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    },
    canPerformOcr: Boolean(imagePath),
    hasOcrText: Boolean(ocrText.trim()),
    hasGeneratedImage: Boolean(activeGeneratedImageUrl)
  });

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      setIsSidebarOpen(false);
      return;
    }

    // Set flags before calling session manager
    suppressAutoProcessRef.current = true;
    suppressPromptResetRef.current = true;

    try {
      const session = await sessionManagerSelectSession(sessionId);
      if (!session) {
        return;
      }

      setGeneratedImageOwnerSessionId(sessionId);

      // Check if session has any OCR data (text or processed image)
      const hasOcrData = Boolean(session.ocr.ocrText || session.ocr.processedImageUrl);
      setHasPerformedOcr(hasOcrData);

      // After restoring session, check if auto-processing is needed
      // This handles the case where OCR completed while this session was not active
      const sessionOcrText = session.ocr.ocrText?.trim() || '';
      const sessionOptimizedText = session.ocr.optimizedText?.trim() || '';
      const sessionOptimizedPrompt = session.prompt.optimizedPrompt?.trim() || '';

      // Reset auto-processing tracking to allow processing for this restored session
      // This ensures that if OCR completed while session was inactive, auto-processing will trigger now
      // The useEffect hooks will check automationSettings and trigger auto-processing if needed
      resetConditionalTracking(sessionOcrText, sessionOptimizedText, sessionOptimizedPrompt);
    } finally {
      // Reset flags after all async operations complete
      suppressAutoProcessRef.current = false;
      suppressPromptResetRef.current = false;
    }

    setIsSidebarOpen(false);
  }, [activeSessionId, sessionManagerSelectSession, setGeneratedImageOwnerSessionId, resetConditionalTracking]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const wasActiveSession = sessionManagerDeleteSession(sessionId);

    // If we deleted the active session, clear related state
    if (wasActiveSession) {
      setHasPerformedOcr(false);
      clearGeneratedImage();
      setGeneratedImageOwnerSessionId(null);
    }
  }, [sessionManagerDeleteSession, clearGeneratedImage, setGeneratedImageOwnerSessionId]);

  return (
    <ErrorBoundary>
      <div className="container">
        <ErrorNotification errors={errors} onErrorDismiss={clearError} />
      {imagePath && (
        <h1><span className="emoji">🪄</span> Imagio  <span className="emoji">✨</span></h1>
      )}

      <SidebarContainer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        automationSettings={automationSettings}
        onAutomationSettingChange={updateAutomationSetting}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onSessionsChange={setSessions}
        onOpenSettings={() => {
          setIsSidebarOpen(false);
          setIsSettingsOpen(true);
        }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      <SettingsContainer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        llmSettings={llmSettings}
        onLLMSettingChange={(key: string, value: unknown) => updateLLMSetting(key as keyof typeof llmSettings, value as string | number)}
        bflApiKey={bflApiKey}
        onBflApiKeyChange={setBflApiKey}
        geminiApiKey={geminiApiKey}
        onGeminiApiKeyChange={setGeminiApiKey}
        bltcyApiKey={bltcyApiKey}
        onBltcyApiKeyChange={setBltcyApiKey}
        selectedModel={selectedModel}
        onSelectedModelChange={setSelectedModel}
        processingParams={params}
        onProcessingParamChange={(key: string, value: number | boolean | string) => updateParam(key as keyof typeof params, value)}
      />

      {imagePath && (
        <Toolbar
          onSelectImage={() => { void selectImage(); }}
          onTakeScreenshot={() => { void takeScreenshot(); }}
          language={params.language}
          onLanguageChange={handleLanguageChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />
      )}

      <ProcessingStatus isProcessing={isProcessing} statusMessage={processingStatus} />

      {imagePath ? (
        <div className={gridClassName}>
          <OcrContainer
            imagePreviewUrl={imagePreviewUrl}
            processedImageUrl={processedImageUrl}
            ocrText={ocrText}
            optimizedText={optimizedText}
            isOptimizingText={isOptimizingText}
            textDisplayMode={textDisplayMode}
            hasPerformedOcr={hasPerformedOcr}
            onOcrTextChange={updateOcrText}
            onOptimizedTextChange={updateOptimizedText}
            onCopy={() => copyOcrText()}
            onSave={() => saveOcrText()}
            onOptimize={optimizeOcrText}
            onTextDisplayModeChange={setTextDisplayMode}
          />

          {hasPerformedOcr && (
            <PromptContainer
              imageStyle={imageStyle}
              aspectRatio={aspectRatio}
              customDescription={customDescription}
              optimizedPrompt={optimizedPrompt}
              isOptimizing={isOptimizing}
              llmError={llmError}
              ocrText={ocrText}
              isGenerating={isActiveSessionGenerating}
              isGenerationLocked={isGenerationLocked}
              generatedImageUrl={activeGeneratedImageUrl}
              generationStatus={generationStatus}
              hasRemoteImageUrl={Boolean(activeGeneratedImageRemoteUrl)}
              onImageStyleChange={setImageStyle}
              onAspectRatioChange={setAspectRatio}
              onCustomDescriptionChange={setCustomDescription}
              onOptimizedPromptChange={setOptimizedPrompt}
              onOptimize={optimizePrompt}
              onCopyPrompt={handleCopyPrompt}
              onGenerateImage={handleGenerateImage}
              onSaveGeneratedImage={() => saveGeneratedImage()}
              onCopyGeneratedImage={() => copyGeneratedImageToClipboard()}
              onCopyGeneratedImageUrl={() => copyGeneratedImageUrl()}
              onClearGeneratedImage={handleClearGeneratedImage}
            />
          )}
        </div>
      ) : (
        <EmptyState
          onSelectImage={() => { void selectImage(); }}
          onTakeScreenshot={() => { void takeScreenshot(); }}
          language={params.language}
          onLanguageChange={handleLanguageChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />
      )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
