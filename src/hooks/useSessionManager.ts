import { useState, useCallback, useEffect } from 'react';
import type { Session, SessionListItem, AppSettings } from '../types/session';
import { createEmptySession, DEFAULT_APP_SETTINGS } from '../types/session';

const STORAGE_KEY_SESSIONS = 'imagio_sessions';
const STORAGE_KEY_ACTIVE_SESSION = 'imagio_active_session';
const STORAGE_KEY_SETTINGS = 'imagio_settings';

interface UseSessionManagerReturn {
  // Sessions
  sessions: Map<string, Session>;
  sessionList: SessionListItem[];
  activeSessionId: string | null;
  activeSession: Session | null;
  
  // Settings
  settings: AppSettings;
  
  // Actions
  createSession: (imagePath?: string) => string;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  updateSettings: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  
  // Batch operations
  createMultipleSessions: (imagePaths: string[]) => string[];
}

export const useSessionManager = (): UseSessionManagerReturn => {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      // Load sessions
      const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions) as Array<[string, Session]>;
        setSessions(new Map(parsed));
      } else {
        // Create initial session if none exist
        const initialSession = createEmptySession();
        setSessions(new Map([[initialSession.id, initialSession]]));
        setActiveSessionId(initialSession.id);
      }

      // Load active session
      const savedActiveSession = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
      if (savedActiveSession) {
        setActiveSessionId(savedActiveSession);
      }

      // Load settings
      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        setSettings({ ...DEFAULT_APP_SETTINGS, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }, []);

  // Save to localStorage when sessions change
  useEffect(() => {
    try {
      const sessionsArray = Array.from(sessions.entries());
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsArray));
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }, [sessions]);

  // Save active session when it changes
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, activeSessionId);
    }
  }, [activeSessionId]);

  // Save settings when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  const createSession = useCallback((imagePath?: string): string => {
    const newSession = createEmptySession(imagePath || '');
    
    setSessions(prev => {
      const updated = new Map(prev);
      updated.set(newSession.id, newSession);
      return updated;
    });
    
    setActiveSessionId(newSession.id);
    return newSession.id;
  }, []);

  const createMultipleSessions = useCallback((imagePaths: string[]): string[] => {
    const newSessionIds: string[] = [];
    
    setSessions(prev => {
      const updated = new Map(prev);
      
      for (const imagePath of imagePaths) {
        const newSession = createEmptySession(imagePath);
        updated.set(newSession.id, newSession);
        newSessionIds.push(newSession.id);
      }
      
      return updated;
    });
    
    // Set the first new session as active
    if (newSessionIds.length > 0) {
      setActiveSessionId(newSessionIds[0]);
    }
    
    return newSessionIds;
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    if (sessions.has(sessionId)) {
      setActiveSessionId(sessionId);
    }
  }, [sessions]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const updated = new Map(prev);
      updated.delete(sessionId);
      
      // If we deleted the active session, switch to another
      if (activeSessionId === sessionId) {
        const remaining = Array.from(updated.keys());
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0]);
        } else {
          // Create a new empty session if we deleted the last one
          const newSession = createEmptySession();
          updated.set(newSession.id, newSession);
          setActiveSessionId(newSession.id);
        }
      }
      
      return updated;
    });
  }, [activeSessionId]);

  const updateSession = useCallback((sessionId: string, updates: Partial<Session>) => {
    setSessions(prev => {
      const session = prev.get(sessionId);
      if (!session) return prev;
      
      const updated = new Map(prev);
      updated.set(sessionId, {
        ...session,
        ...updates,
        updatedAt: Date.now(),
      });
      
      return updated;
    });
  }, []);

  const updateSettings = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const sessionList: SessionListItem[] = Array.from(sessions.values())
    .map(session => ({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      imagePath: session.imagePath,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const activeSession = activeSessionId ? sessions.get(activeSessionId) || null : null;

  return {
    sessions,
    sessionList,
    activeSessionId,
    activeSession,
    settings,
    createSession,
    selectSession,
    deleteSession,
    updateSession,
    updateSettings,
    createMultipleSessions,
  };
};
