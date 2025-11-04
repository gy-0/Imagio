import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { AppSession, SessionSource } from '../types/appSession';
import type { SortOption } from '../utils/sessionUtils';
import { updateSessionInPlace, sortSessions, insertSessionSorted } from '../utils/sessionUtils';
import { useSessionStorage } from '../hooks/useSessionStorage';
import { DEFAULT_SORT_OPTION } from '../constants';

interface SessionContextValue {
  // Session state
  sessions: AppSession[];
  activeSessionId: string | null;
  sortBy: SortOption;
  isSessionsLoading: boolean;

  // Session actions
  setSessions: React.Dispatch<React.SetStateAction<AppSession[]>>;
  setActiveSessionId: (id: string | null) => void;
  setSortBy: (sortBy: SortOption) => void;

  // Session operations
  createSession: (details: {
    path: string;
    previewUrl: string;
    source: SessionSource;
    initialSnapshot: {
      ocrParams: any;
      promptSettings: { imageStyle: string; customDescription: string };
      generationSettings: { aspectRatio: string };
    };
  }) => string;

  updateSession: (
    sessionId: string,
    updater: (session: AppSession) => Partial<AppSession>
  ) => void;

  deleteSession: (sessionId: string) => void;

  // Helper refs (for avoiding stale closures)
  activeSessionIdRef: React.MutableRefObject<string | null>;
  sessionsRef: React.MutableRefObject<AppSession[]>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return context;
};

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sessions, setSessions, isLoading: isSessionsLoading } = useSessionStorage();
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT_OPTION);

  // Refs for avoiding stale closures
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionsRef = useRef<AppSession[]>([]);

  // Keep refs in sync
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
  }, []);

  // Re-sort sessions when sortBy changes
  useEffect(() => {
    setSessions(prev => {
      // Avoid unnecessary re-sort if already sorted
      if (prev.length >= 2 && prev[0][sortBy] >= prev[1][sortBy]) {
        const isSorted = prev.every((session, i) =>
          i === 0 || prev[i - 1][sortBy] >= session[sortBy]
        );
        if (isSorted) {
          return prev;
        }
      }
      return sortSessions(prev, sortBy);
    });
  }, [sortBy, setSessions]);

  const generateSessionId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

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

  const createSession = useCallback((details: {
    path: string;
    previewUrl: string;
    source: SessionSource;
    initialSnapshot: {
      ocrParams: any;
      promptSettings: { imageStyle: string; customDescription: string };
      generationSettings: { aspectRatio: string };
    };
  }): string => {
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
        params: details.initialSnapshot.ocrParams
      },
      prompt: {
        imageStyle: details.initialSnapshot.promptSettings.imageStyle,
        customDescription: details.initialSnapshot.promptSettings.customDescription,
        optimizedPrompt: ''
      },
      generation: {
        aspectRatio: details.initialSnapshot.generationSettings.aspectRatio,
        generatedImageUrl: '',
        generatedImageRemoteUrl: '',
        generatedImageLocalPath: ''
      }
    };

    setSessions(prev => insertSessionSorted(prev, newSession, sortBy));
    setActiveSessionId(sessionId);

    return sessionId;
  }, [generateSessionId, deriveSessionTitle, sortBy, setSessions, setActiveSessionId]);

  const updateSession = useCallback((
    sessionId: string,
    updater: (session: AppSession) => Partial<AppSession>
  ) => {
    setSessions(prev => {
      if (!prev.find(s => s.id === sessionId)) {
        return prev;
      }

      return updateSessionInPlace(prev, sessionId, session => ({
        ...session,
        ...updater(session),
        updatedAt: Date.now()
      }), sortBy);
    });
  }, [setSessions, sortBy]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId));

    if (sessionId === activeSessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId, setActiveSessionId, setSessions]);

  const value: SessionContextValue = {
    sessions,
    activeSessionId,
    sortBy,
    isSessionsLoading,
    setSessions,
    setActiveSessionId,
    setSortBy,
    createSession,
    updateSession,
    deleteSession,
    activeSessionIdRef,
    sessionsRef
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
