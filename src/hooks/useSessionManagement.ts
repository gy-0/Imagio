import { useCallback, useEffect, useRef, useState } from 'react';
import { exists as fsExists, remove as fsRemove } from '@tauri-apps/plugin-fs';
import type { AppSession, SessionSource } from '../types/appSession';
import { 
  sortSessions, 
  insertSessionSorted, 
  updateSessionInPlace, 
  generateSessionId, 
  deriveSessionTitle,
  type SortOption 
} from '../utils/sessionUtils';
import type { OcrSessionSnapshot } from '../features/ocr/useOcrProcessing';
import type { PromptSessionSnapshot } from '../features/promptOptimization/usePromptOptimization';
import type { ImageGenerationSessionSnapshot } from '../features/imageGeneration/useImageGeneration';

interface UseSessionManagementOptions {
  sessions: AppSession[];
  setSessions: React.Dispatch<React.SetStateAction<AppSession[]>>;
  isLoading: boolean;
  sortBy: SortOption;
  loadOcrSnapshot: (snapshot: OcrSessionSnapshot) => void;
  loadPromptSnapshot: (snapshot: PromptSessionSnapshot) => void;
  loadGenerationSnapshot: (snapshot: ImageGenerationSessionSnapshot) => Promise<void>;
  clearGeneratedImage: () => void;
  setGeneratedImageOwnerSessionId: (sessionId: string | null) => void;
  setHasPerformedOcr: (value: boolean) => void;
}

const MAX_MAPPING_ENTRIES = 100;
const MAPPING_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export const useSessionManagement = ({
  sessions,
  setSessions,
  isLoading,
  sortBy,
  loadOcrSnapshot,
  loadPromptSnapshot,
  loadGenerationSnapshot,
  clearGeneratedImage,
  setGeneratedImageOwnerSessionId,
  setHasPerformedOcr
}: UseSessionManagementOptions) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentSortBy, setSortBy] = useState<SortOption>(sortBy);
  const isRestoringSessionRef = useRef<boolean>(false);
  const imagePathToSessionIdRef = useRef<Map<string, { sessionId: string; timestamp: number }>>(new Map());

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

  // Create new session
  const createSession = useCallback((
    details: { path: string; previewUrl: string; source: SessionSource },
    options: {
      params: OcrSessionSnapshot['params'];
      imageStyle: PromptSessionSnapshot['imageStyle'];
      customDescription: PromptSessionSnapshot['customDescription'];
      aspectRatio: ImageGenerationSessionSnapshot['aspectRatio'];
    }
  ): string => {
    const sessionId = generateSessionId();
    const timestamp = Date.now();
    const newSession: AppSession = {
      id: sessionId,
      title: deriveSessionTitle(details.path, details.source),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: details.source,
      ocr: {
        imagePath: details.path,
        imagePreviewUrl: details.previewUrl,
        processedImageUrl: '',
        ocrText: '',
        optimizedText: '',
        textDisplayMode: 'original',
        params: options.params
      },
      prompt: {
        imageStyle: options.imageStyle,
        customDescription: options.customDescription,
        optimizedPrompt: ''
      },
      generation: {
        aspectRatio: options.aspectRatio,
        generatedImageUrl: '',
        generatedImageRemoteUrl: '',
        generatedImageLocalPath: ''
      }
    };

    setSessions(prev => insertSessionSorted(prev, newSession, currentSortBy));
    setActiveSessionId(sessionId);
    setHasPerformedOcr(false);
    setGeneratedImageOwnerSessionId(sessionId);
    void loadGenerationSnapshot(newSession.generation);

    // Track the mapping from image path to session ID with timestamp
    cleanupStaleMappings();
    imagePathToSessionIdRef.current.set(details.path, {
      sessionId,
      timestamp: Date.now()
    });

    return sessionId;
  }, [currentSortBy, cleanupStaleMappings, loadGenerationSnapshot, setGeneratedImageOwnerSessionId, setHasPerformedOcr, setSessions]);

  // Get session ID for image path
  const getSessionIdForImagePath = useCallback((imagePath: string): string | null => {
    const entry = imagePathToSessionIdRef.current.get(imagePath);
    return entry?.sessionId ?? null;
  }, []);

  // Remove mapping for image path
  const removeImagePathMapping = useCallback((imagePath: string) => {
    imagePathToSessionIdRef.current.delete(imagePath);
  }, []);

  // Select/restore session
  const selectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }

    const session = sessions.find(item => item.id === sessionId);
    if (!session) {
      return;
    }

    // Prevent switching while already restoring
    if (isRestoringSessionRef.current) {
      console.log('Session restore already in progress, ignoring click');
      return;
    }

    const restoreSession = async () => {
      isRestoringSessionRef.current = true;

      try {
        // First set the active session ID before loading snapshots
        setActiveSessionId(sessionId);

        // Wait for all snapshot loading operations to complete
        await Promise.all([
          Promise.resolve(loadOcrSnapshot(session.ocr)),
          Promise.resolve(loadPromptSnapshot(session.prompt)),
          loadGenerationSnapshot(session.generation)
        ]);

        setGeneratedImageOwnerSessionId(sessionId);

        // Check if session has any OCR data
        const hasOcrData = Boolean(session.ocr.ocrText || session.ocr.processedImageUrl);
        setHasPerformedOcr(hasOcrData);

        setSessions(prev => updateSessionInPlace(prev, sessionId, session => ({
          ...session,
          updatedAt: Date.now()
        }), currentSortBy));

        // Wait for next tick to ensure all setState calls have been processed
        await new Promise(resolve => setTimeout(resolve, 0));
      } finally {
        isRestoringSessionRef.current = false;
      }
    };

    void restoreSession();
  }, [
    activeSessionId,
    sessions,
    loadOcrSnapshot,
    loadPromptSnapshot,
    loadGenerationSnapshot,
    currentSortBy,
    setGeneratedImageOwnerSessionId,
    setHasPerformedOcr,
    setSessions
  ]);

  // Delete session
  const deleteSessionImageFile = useCallback(async (filePath: string) => {
    if (!filePath) {
      return;
    }

    try {
      const fileExists = await fsExists(filePath);
      if (fileExists) {
        await fsRemove(filePath);
      }
    } catch (error) {
      console.warn('Failed to delete generated image file:', filePath, error);
    }
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const sessionToDelete = prev.find(session => session.id === sessionId);
      if (sessionToDelete?.generation.generatedImageLocalPath) {
        void deleteSessionImageFile(sessionToDelete.generation.generatedImageLocalPath);
      }
      return prev.filter(session => session.id !== sessionId);
    });

    // If we deleted the active session, clear the active session
    if (sessionId === activeSessionId) {
      setActiveSessionId(null);
      setHasPerformedOcr(false);
      clearGeneratedImage();
      setGeneratedImageOwnerSessionId(null);
    }
  }, [activeSessionId, clearGeneratedImage, deleteSessionImageFile, setGeneratedImageOwnerSessionId, setSessions, setHasPerformedOcr]);

  // Update session helper
  const updateSession = useCallback((
    sessionId: string,
    updater: (session: AppSession) => AppSession
  ) => {
    setSessions(prev => updateSessionInPlace(prev, sessionId, updater, currentSortBy));
  }, [currentSortBy, setSessions]);

  // Re-sort sessions when sortBy changes
  useEffect(() => {
    setSessions(prev => {
      // Avoid unnecessary re-sort if already sorted by this criterion
      if (prev.length >= 2 && prev[0][currentSortBy] >= prev[1][currentSortBy]) {
        const isSorted = prev.every((session, i) =>
          i === 0 || prev[i - 1][currentSortBy] >= session[currentSortBy]
        );
        if (isSorted) {
          return prev;
        }
      }
      return sortSessions(prev, currentSortBy);
    });
  }, [currentSortBy, setSessions]);

  // Cleanup mapping table on unmount
  useEffect(() => {
    return () => {
      imagePathToSessionIdRef.current.clear();
    };
  }, []);

  return {
    activeSessionId,
    setActiveSessionId,
    sortBy: currentSortBy,
    setSortBy,
    createSession,
    selectSession,
    deleteSession,
    updateSession,
    getSessionIdForImagePath,
    removeImagePathMapping,
    isRestoringSessionRef
  };
};

