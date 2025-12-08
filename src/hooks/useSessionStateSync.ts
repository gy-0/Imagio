import { useEffect, useRef } from 'react';
import { AppSession } from '../types/appSession';
import { ProcessingParams } from '../features/ocr/types';
import { updateSessionInPlace } from '../utils/sessionUtils';

interface OcrState {
  imagePath: string;
  imagePreviewUrl: string;
  processedImageUrl: string;
  ocrText: string;
  optimizedText: string;
  textDisplayMode: 'original' | 'optimized';
  params: ProcessingParams;
}

interface PromptState {
  imageStyle: string;
  customDescription: string;
  optimizedPrompt: string;
}

interface GenerationState {
  aspectRatio: string;
  generatedImageRemoteUrl: string;
  generatedImageLocalPath: string;
}

interface UseSessionStateSyncProps {
  activeSessionId: string | null;
  isRestoringSession: boolean;
  isSessionsLoading: boolean;
  sortBy: 'createdAt' | 'updatedAt';
  setSessions: React.Dispatch<React.SetStateAction<AppSession[]>>;

  // OCR state
  ocrState: OcrState;
  isOptimizingText: boolean;

  // Prompt state
  promptState: PromptState;
  isOptimizing: boolean;

  // Generation state
  generationState: GenerationState;
  isGenerating: boolean;
  currentGenerationSessionIdRef: React.MutableRefObject<string | null>;
  setCurrentGenerationSessionId: (id: string | null) => void;

  // OCR text change handling
  setHasPerformedOcr: (value: boolean) => void;
  setOptimizedPrompt: (value: string) => void;
}

/**
 * Hook to synchronize session state with the session manager
 * Extracts complex useEffect logic from App.tsx for better maintainability
 */
export const useSessionStateSync = ({
  activeSessionId,
  isRestoringSession,
  isSessionsLoading,
  sortBy,
  setSessions,
  ocrState,
  isOptimizingText,
  promptState,
  isOptimizing,
  generationState,
  isGenerating,
  currentGenerationSessionIdRef,
  setCurrentGenerationSessionId,
  setHasPerformedOcr,
  setOptimizedPrompt,
}: UseSessionStateSyncProps) => {
  const previousOcrText = useRef<string>('');

  // Sync OCR state to session
  useEffect(() => {
    if (!activeSessionId || isRestoringSession || isSessionsLoading) {
      return;
    }

    // Don't update session state while optimization is in progress
    if (isOptimizingText) {
      return;
    }

    setSessions(prev => {
      if (!prev.find(s => s.id === activeSessionId)) {
        return prev;
      }

      return updateSessionInPlace(prev, activeSessionId, session => ({
        ...session,
        updatedAt: Date.now(),
        ocr: {
          imagePath: ocrState.imagePath,
          imagePreviewUrl: ocrState.imagePreviewUrl,
          processedImageUrl: ocrState.processedImageUrl,
          ocrText: ocrState.ocrText,
          optimizedText: ocrState.optimizedText,
          textDisplayMode: ocrState.textDisplayMode,
          params: ocrState.params
        }
      }), sortBy);
    });
  }, [
    activeSessionId,
    ocrState.imagePath,
    ocrState.imagePreviewUrl,
    ocrState.processedImageUrl,
    ocrState.ocrText,
    ocrState.optimizedText,
    ocrState.textDisplayMode,
    ocrState.params,
    isOptimizingText,
    isSessionsLoading,
    isRestoringSession,
    setSessions,
    sortBy
  ]);

  // Sync prompt state to session
  useEffect(() => {
    if (!activeSessionId || isRestoringSession || isSessionsLoading) {
      return;
    }

    if (isOptimizing) {
      return;
    }

    setSessions(prev => {
      if (!prev.find(s => s.id === activeSessionId)) {
        return prev;
      }

      return updateSessionInPlace(prev, activeSessionId, session => ({
        ...session,
        updatedAt: Date.now(),
        prompt: {
          imageStyle: promptState.imageStyle,
          customDescription: promptState.customDescription,
          optimizedPrompt: promptState.optimizedPrompt
        }
      }), sortBy);
    });
  }, [
    activeSessionId,
    promptState.imageStyle,
    promptState.customDescription,
    promptState.optimizedPrompt,
    isOptimizing,
    isSessionsLoading,
    isRestoringSession,
    setSessions,
    sortBy
  ]);

  // Sync generation state to session
  useEffect(() => {
    if (isRestoringSession || isSessionsLoading) {
      return;
    }

    if (isGenerating) {
      return;
    }

    const targetSessionId = currentGenerationSessionIdRef.current ?? activeSessionId;
    if (!targetSessionId) {
      return;
    }

    setSessions(prev => {
      if (!prev.find(s => s.id === targetSessionId)) {
        return prev;
      }

      return updateSessionInPlace(prev, targetSessionId, session => ({
        ...session,
        updatedAt: Date.now(),
        generation: {
          aspectRatio: generationState.aspectRatio,
          generatedImageUrl: '',
          generatedImageRemoteUrl: generationState.generatedImageRemoteUrl,
          generatedImageLocalPath: generationState.generatedImageLocalPath
        }
      }), sortBy);
    });

    if (currentGenerationSessionIdRef.current) {
      setCurrentGenerationSessionId(null);
      currentGenerationSessionIdRef.current = null;
    }
  }, [
    activeSessionId,
    generationState.aspectRatio,
    generationState.generatedImageLocalPath,
    generationState.generatedImageRemoteUrl,
    isGenerating,
    isSessionsLoading,
    isRestoringSession,
    setSessions,
    sortBy,
    currentGenerationSessionIdRef,
    setCurrentGenerationSessionId
  ]);

  // Handle OCR text changes
  useEffect(() => {
    if (isRestoringSession) {
      return;
    }

    if (previousOcrText.current !== ocrState.ocrText) {
      if (ocrState.ocrText) {
        setHasPerformedOcr(true);
      }

      if (previousOcrText.current) {
        setOptimizedPrompt('');
      }

      previousOcrText.current = ocrState.ocrText;
    }
  }, [ocrState.ocrText, isRestoringSession, setOptimizedPrompt, setHasPerformedOcr]);
};
