import { useCallback, useRef, useState } from 'react';
import type { Session, AppSettings } from '../types/session';

interface ProcessingQueue {
  sessionId: string;
  imagePath: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface UseAutomationOptions {
  settings: AppSettings;
  activeSession: Session | null;
  // updateSession: (sessionId: string, updates: Partial<Session>) => void; // TODO: Use this for session updates
  performOCR: (sessionId: string) => Promise<void>;
  optimizeOcrText: (sessionId: string) => Promise<void>;
  optimizePrompt: (sessionId: string) => Promise<void>;
  generateImage: (sessionId: string) => Promise<void>;
  saveImage: (sessionId: string) => Promise<void>;
}

export const useAutomation = (options: UseAutomationOptions) => {
  const {
    settings,
    activeSession,
    // updateSession, // TODO: Use for session state updates
    performOCR,
    optimizeOcrText,
    optimizePrompt,
    generateImage,
    saveImage,
  } = options;

  const [processingQueue, setProcessingQueue] = useState<ProcessingQueue[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const processingRef = useRef(false);

  // Process a single session through the automation pipeline
  const processSession = useCallback(async (sessionId: string) => {
    try {
      // Step 1: Perform OCR (always required)
      await performOCR(sessionId);

      // Step 2: Optimize OCR text if enabled
      if (settings.autoOptimizeOcr) {
        await optimizeOcrText(sessionId);
      }

      // Step 3: Generate prompt if enabled
      if (settings.autoGeneratePrompt) {
        await optimizePrompt(sessionId);
      }

      // Step 4: Generate image if enabled
      if (settings.autoGenerateImage) {
        await generateImage(sessionId);
        
        // Step 5: Save image if enabled
        if (settings.autoSaveImage) {
          await saveImage(sessionId);
        }
      }

      return { success: true };
    } catch (error) {
      console.error(`Error processing session ${sessionId}:`, error);
      return { success: false, error: String(error) };
    }
  }, [settings, performOCR, optimizeOcrText, optimizePrompt, generateImage, saveImage]);

  // Process the queue sequentially (for OCR to avoid overload)
  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      console.log('Already processing queue');
      return;
    }

    processingRef.current = true;
    setIsProcessingQueue(true);

    try {
      while (true) {
        // Find next pending item
        const nextItem = processingQueue.find(item => item.status === 'pending');
        if (!nextItem) break;

        // Update status to processing
        setProcessingQueue(prev =>
          prev.map(item =>
            item.sessionId === nextItem.sessionId
              ? { ...item, status: 'processing' as const }
              : item
          )
        );

        // Process the session
        const result = await processSession(nextItem.sessionId);

        // Update status based on result
        setProcessingQueue(prev =>
          prev.map(item =>
            item.sessionId === nextItem.sessionId
              ? {
                  ...item,
                  status: result.success ? 'completed' as const : 'error' as const,
                  error: result.error,
                }
              : item
          )
        );

        // Small delay between processing to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      processingRef.current = false;
      setIsProcessingQueue(false);
      
      // Clean up completed/error items after a delay
      setTimeout(() => {
        setProcessingQueue(prev =>
          prev.filter(item => item.status === 'pending' || item.status === 'processing')
        );
      }, 5000);
    }
  }, [processingQueue, processSession]);

  // Add sessions to the processing queue
  const queueSessions = useCallback((sessionIds: string[], imagePaths: string[]) => {
    const newItems: ProcessingQueue[] = sessionIds.map((sessionId, index) => ({
      sessionId,
      imagePath: imagePaths[index] || '',
      status: 'pending' as const,
    }));

    setProcessingQueue(prev => [...prev, ...newItems]);

    // Start processing if not already running
    if (!processingRef.current) {
      // Use setTimeout to ensure state is updated before processing
      setTimeout(() => processQueue(), 0);
    }
  }, [processQueue]);

  // Trigger automation based on session state changes
  const handleSessionChange = useCallback(async (session: Session, previousState: Partial<Session>) => {
    if (!activeSession || session.id !== activeSession.id) {
      return;
    }

    // Auto-optimize OCR if text changed and setting is enabled
    if (
      settings.autoOptimizeOcr &&
      session.ocrText &&
      session.ocrText !== previousState.ocrText &&
      !session.isOptimizingText
    ) {
      await optimizeOcrText(session.id);
    }

    // Auto-generate prompt if OCR text is ready
    if (
      settings.autoGeneratePrompt &&
      (session.ocrText || session.optimizedOcrText) &&
      (session.ocrText !== previousState.ocrText ||
        session.optimizedOcrText !== previousState.optimizedOcrText) &&
      !session.isOptimizingPrompt
    ) {
      await optimizePrompt(session.id);
    }

    // Auto-generate image if prompt is ready
    if (
      settings.autoGenerateImage &&
      session.optimizedPrompt &&
      session.optimizedPrompt !== previousState.optimizedPrompt &&
      !session.isGeneratingImage
    ) {
      await generateImage(session.id);
    }

    // Auto-save image if generated
    if (
      settings.autoSaveImage &&
      session.generatedImageUrl &&
      session.generatedImageUrl !== previousState.generatedImageUrl
    ) {
      await saveImage(session.id);
    }
  }, [settings, activeSession, optimizeOcrText, optimizePrompt, generateImage, saveImage]);

  return {
    processingQueue,
    isProcessingQueue,
    queueSessions,
    processSession,
    handleSessionChange,
  };
};
