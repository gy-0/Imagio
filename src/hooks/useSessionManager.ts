import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStorage } from './useSessionStorage';
import { updateSessionInPlace, sortSessions, insertSessionSorted } from '../utils/sessionUtils';
import type { SessionSource, AppSession } from '../types/appSession';
import type { SortOption } from '../utils/sessionUtils';
import { exists as fsExists, remove as fsRemove } from '@tauri-apps/plugin-fs';
import { MAX_MAPPING_ENTRIES, MAPPING_MAX_AGE_MS, DEFAULT_SORT_OPTION } from '../constants';

interface UseSessionManagerProps {
  loadOcrSnapshot: (ocr: AppSession['ocr']) => void;
  loadPromptSnapshot: (prompt: AppSession['prompt']) => void;
  loadGenerationSnapshot: (generation: AppSession['generation']) => Promise<void>;
  defaultOcrParams: AppSession['ocr']['params'];
  defaultPromptState: {
    imageStyle: string;
    customDescription: string;
  };
  defaultGenerationState: {
    aspectRatio: string;
  };
}

interface ImagePathMappingEntry {
  sessionId: string;
  timestamp: number;
}

export const useSessionManager = (props: UseSessionManagerProps) => {
  const {
    loadOcrSnapshot,
    loadPromptSnapshot,
    loadGenerationSnapshot,
    defaultOcrParams,
    defaultPromptState,
    defaultGenerationState
  } = props;

  // Session storage
  const { sessions, setSessions, isLoading: isSessionsLoading } = useSessionStorage();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT_OPTION);

  // Refs for session management
  const isRestoringSessionRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const imagePathToSessionIdRef = useRef<Map<string, ImagePathMappingEntry>>(new Map());
  const onNewImageHandlerRef = useRef<((details: { path: string; previewUrl: string; source: SessionSource; }) => string) | null>(null);

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

  // Delete session image file
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

  // Generate session ID
  const generateSessionId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  // Derive session title from path and source
  const deriveSessionTitle = useCallback((path: string, source: SessionSource) => {
    if (path) {
      const parts = path.split(/[/\\]/);
      const filename = parts[parts.length - 1];
      if (filename) {
        return filename;
      }
    }

    const timestamp = new Date().toLocaleTimeString();
    switch (source) {
      case 'screenshot':
        return `Screenshot ${timestamp}`;
      case 'drop':
        return `Drag & Drop ${timestamp}`;
      default:
        return `Session ${timestamp}`;
    }
  }, []);

  // Create new session from image
  const handleNewImage = useCallback((details: { path: string; previewUrl: string; source: SessionSource; }) => {
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
        params: defaultOcrParams
      },
      prompt: {
        imageStyle: defaultPromptState.imageStyle,
        customDescription: defaultPromptState.customDescription,
        optimizedPrompt: ''
      },
      generation: {
        aspectRatio: defaultGenerationState.aspectRatio,
        generatedImageUrl: '',
        generatedImageRemoteUrl: '',
        generatedImageLocalPath: ''
      }
    };

    setSessions(prev => insertSessionSorted(prev, newSession, sortBy));
    setActiveSessionId(sessionId);
    void loadGenerationSnapshot(newSession.generation);

    // Track the mapping from image path to session ID with timestamp
    // Clean up old entries before adding new one
    cleanupStaleMappings();
    imagePathToSessionIdRef.current.set(details.path, {
      sessionId,
      timestamp: Date.now()
    });

    // Return the session ID so caller can update the session later
    return sessionId;
  }, [
    cleanupStaleMappings,
    defaultGenerationState.aspectRatio,
    defaultOcrParams,
    defaultPromptState.customDescription,
    defaultPromptState.imageStyle,
    deriveSessionTitle,
    generateSessionId,
    loadGenerationSnapshot,
    setSessions,
    sortBy
  ]);

  // Select and restore a session
  const handleSelectSession = useCallback((sessionId: string) => {
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
        // This ensures the effects know which session is being restored
        setActiveSessionId(sessionId);

        // Wait for all snapshot loading operations to complete
        // This ensures state is fully synchronized before resetting flags
        await Promise.all([
          Promise.resolve(loadOcrSnapshot(session.ocr)),
          Promise.resolve(loadPromptSnapshot(session.prompt)),
          loadGenerationSnapshot(session.generation)
        ]);

        setSessions(prev => updateSessionInPlace(prev, sessionId, session => ({
          ...session,
          updatedAt: Date.now()
        }), sortBy));

        // Wait for next tick to ensure all setState calls have been processed
        await new Promise(resolve => setTimeout(resolve, 0));

        return session;
      } finally {
        // Reset flag after all async operations complete
        isRestoringSessionRef.current = false;
      }
    };

    return restoreSession();
  }, [
    sessions,
    loadOcrSnapshot,
    loadPromptSnapshot,
    loadGenerationSnapshot,
    setSessions,
    sortBy
  ]);

  // Delete a session
  const handleDeleteSession = useCallback((sessionId: string) => {
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
      return true; // Indicate that active session was deleted
    }
    return false;
  }, [activeSessionId, deleteSessionImageFile, setSessions]);

  // Update session data
  const updateSession = useCallback((
    sessionId: string,
    updater: (session: AppSession) => AppSession
  ) => {
    setSessions(prev => updateSessionInPlace(prev, sessionId, updater, sortBy));
  }, [setSessions, sortBy]);

  // Get image path mapping
  const getSessionIdForImagePath = useCallback((imagePath: string): string | null => {
    const entry = imagePathToSessionIdRef.current.get(imagePath);
    return entry?.sessionId ?? null;
  }, []);

  // Remove image path mapping
  const removeImagePathMapping = useCallback((imagePath: string) => {
    imagePathToSessionIdRef.current.delete(imagePath);
  }, []);

  // Register the new image handler
  useEffect(() => {
    onNewImageHandlerRef.current = handleNewImage;
  }, [handleNewImage]);

  // Keep activeSessionIdRef in sync with state
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Cleanup mapping table on unmount
  useEffect(() => {
    return () => {
      imagePathToSessionIdRef.current.clear();
    };
  }, []);

  // Re-sort sessions when sortBy changes
  useEffect(() => {
    setSessions(prev => {
      // Avoid unnecessary re-sort if already sorted by this criterion
      // Check if first two elements are in correct order (heuristic)
      if (prev.length >= 2 && prev[0][sortBy] >= prev[1][sortBy]) {
        // Likely already sorted, but verify with full check
        const isSorted = prev.every((session, i) =>
          i === 0 || prev[i - 1][sortBy] >= session[sortBy]
        );
        if (isSorted) {
          return prev; // No need to re-sort
        }
      }
      return sortSessions(prev, sortBy);
    });
  }, [sortBy, setSessions]);

  return {
    // State
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    sortBy,
    setSortBy,
    isSessionsLoading,

    // Refs
    isRestoringSessionRef,
    activeSessionIdRef,
    onNewImageHandlerRef,

    // Methods
    handleNewImage,
    handleSelectSession,
    handleDeleteSession,
    updateSession,
    getSessionIdForImagePath,
    removeImagePathMapping
  };
};
