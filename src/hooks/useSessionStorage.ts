import { useEffect, useRef, useState } from 'react';
import type { AppSession } from '../types/appSession';

interface UseSessionStorageResult {
  sessions: AppSession[];
  setSessions: React.Dispatch<React.SetStateAction<AppSession[]>>;
  isLoading: boolean;
}

const STORAGE_KEY = 'imagio-sessions';
const MAX_SESSIONS = 50; // Limit to prevent localStorage quota issues

/**
 * Hook to persist session history in localStorage.
 * Sessions are automatically saved whenever they change.
 */
export const useSessionStorage = (): UseSessionStorageResult => {
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasLoadedRef = useRef<boolean>(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      try {
        const stored = typeof window !== 'undefined'
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;

        if (stored) {
          const parsed = JSON.parse(stored) as AppSession[];

          // Validate and sanitize the loaded sessions
          const validSessions = parsed.filter(session =>
            session &&
            typeof session.id === 'string' &&
            typeof session.title === 'string' &&
            typeof session.createdAt === 'number' &&
            typeof session.updatedAt === 'number'
          );

          if (isMounted) {
            setSessions(validSessions);
          }
        }
      } catch (error) {
        console.error('Failed to load sessions from localStorage:', error);
        // Start with empty sessions on error
        if (isMounted) {
          setSessions([]);
        }
      } finally {
        if (isMounted) {
          hasLoadedRef.current = true;
          setIsLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    // Don't save until initial load is complete
    if (isLoading || !hasLoadedRef.current) {
      return;
    }

    try {
      // Limit the number of sessions to prevent localStorage quota issues
      const sessionsToSave = sessions.slice(0, MAX_SESSIONS);

      // Clean up blob URLs before saving (they won't be valid after restart)
      const sanitizedSessions = sessionsToSave.map(session => ({
        ...session,
        generation: {
          ...session.generation,
          // Don't persist local blob URLs, only remote URLs
          generatedImageUrl: ''
        }
      }));

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedSessions));
      }
    } catch (error) {
      // Handle quota exceeded errors gracefully
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Reducing session count...');
        try {
          // Try saving with fewer sessions
          const reducedSessions = sessions.slice(0, Math.floor(MAX_SESSIONS / 2));
          const sanitizedSessions = reducedSessions.map(session => ({
            ...session,
            generation: {
              ...session.generation,
              generatedImageUrl: ''
            }
          }));
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedSessions));
          }
        } catch (retryError) {
          console.error('Failed to save sessions even with reduced count:', retryError);
        }
      } else {
        console.error('Failed to persist sessions:', error);
      }
    }
  }, [sessions, isLoading]);

  return {
    sessions,
    setSessions,
    isLoading
  };
};
