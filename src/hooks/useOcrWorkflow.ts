import { useCallback, useEffect, useRef } from 'react';
import { useSessionContext } from '../context/SessionContext';
import { useAutomationContext } from '../context/AutomationContext';
import { MAX_MAPPING_ENTRIES, MAPPING_MAX_AGE_MS } from '../constants';

interface ImagePathMapping {
  sessionId: string;
  timestamp: number;
}

/**
 * Hook to manage OCR workflow and session image mapping
 */
export const useOcrWorkflow = () => {
  const { activeSessionIdRef, updateSession } = useSessionContext();
  const {
    settingsRef: automationSettingsRef,
    isRestoringSessionRef,
    lastAutoOptimizedOcrRef,
    lastAutoPromptRef
  } = useAutomationContext();

  // Map image paths to session IDs
  const imagePathToSessionIdRef = useRef<Map<string, ImagePathMapping>>(new Map());

  // Store optimization function ref
  const optimizeOcrTextRef = useRef<((textToOptimize?: string) => Promise<void>) | null>(null);

  // Cleanup stale mapping entries
  const cleanupStaleMappings = useCallback(() => {
    const now = Date.now();
    const map = imagePathToSessionIdRef.current;

    for (const [path, entry] of map.entries()) {
      if (now - entry.timestamp > MAPPING_MAX_AGE_MS) {
        map.delete(path);
      }
    }

    // If still over capacity, remove oldest entries
    if (map.size > MAX_MAPPING_ENTRIES) {
      const entries = Array.from(map.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, map.size - MAX_MAPPING_ENTRIES);
      toRemove.forEach(([path]) => map.delete(path));
    }
  }, []);

  // Register image path to session ID mapping
  const registerImagePath = useCallback((imagePath: string, sessionId: string) => {
    cleanupStaleMappings();
    imagePathToSessionIdRef.current.set(imagePath, {
      sessionId,
      timestamp: Date.now()
    });
  }, [cleanupStaleMappings]);

  // Handle OCR completion
  const handleOcrComplete = useCallback((details: {
    imagePath: string;
    ocrText: string;
    processedImageUrl: string;
  }) => {
    const entry = imagePathToSessionIdRef.current.get(details.imagePath);
    if (!entry) {
      console.warn('[useOcrWorkflow] No session found for image path:', details.imagePath);
      return;
    }
    const sessionId = entry.sessionId;

    const currentActiveSessionId = activeSessionIdRef.current;
    const currentAutomationSettings = automationSettingsRef.current;

    // Update session with OCR results
    updateSession(sessionId, session => ({
      ocr: {
        ...session.ocr,
        processedImageUrl: details.processedImageUrl,
        ocrText: details.ocrText,
        optimizedText: '',
        textDisplayMode: 'original' as const
      }
    }));

    // Auto-optimize: Only trigger for current active session
    if (sessionId === currentActiveSessionId &&
        currentAutomationSettings.autoOptimizeOcr &&
        details.ocrText.trim() &&
        !isRestoringSessionRef.current) {
      lastAutoOptimizedOcrRef.current = details.ocrText;
      void optimizeOcrTextRef.current?.(details.ocrText);
    }

    // Auto-generate prompt: Reset flag to allow generation
    if (sessionId === currentActiveSessionId &&
        currentAutomationSettings.autoGeneratePrompt &&
        details.ocrText.trim() &&
        !isRestoringSessionRef.current) {
      lastAutoPromptRef.current = '';
    }

    // Clean up the mapping
    imagePathToSessionIdRef.current.delete(details.imagePath);
  }, [
    activeSessionIdRef,
    automationSettingsRef,
    isRestoringSessionRef,
    lastAutoOptimizedOcrRef,
    lastAutoPromptRef,
    updateSession
  ]);

  // Handle OCR optimization completion
  const handleOptimizeComplete = useCallback((details: {
    imagePath: string;
    optimizedText: string;
  }) => {
    const currentActiveSessionId = activeSessionIdRef.current;
    if (!currentActiveSessionId) {
      return;
    }

    updateSession(currentActiveSessionId, session => {
      if (session.ocr.imagePath !== details.imagePath) {
        return {};
      }

      return {
        ocr: {
          ...session.ocr,
          optimizedText: details.optimizedText,
          textDisplayMode: 'optimized' as const
        }
      };
    });
  }, [activeSessionIdRef, updateSession]);

  // Handle OCR error
  const handleOcrError = useCallback((details: {
    imagePath: string;
    error: string;
  }) => {
    imagePathToSessionIdRef.current.delete(details.imagePath);
    console.error('[useOcrWorkflow] OCR processing failed:', details.error, 'for image:', details.imagePath);
  }, []);

  // Cleanup mapping table on unmount
  useEffect(() => {
    return () => {
      imagePathToSessionIdRef.current.clear();
    };
  }, []);

  return {
    registerImagePath,
    handleOcrComplete,
    handleOptimizeComplete,
    handleOcrError,
    optimizeOcrTextRef,
    imagePathToSessionIdRef
  };
};
