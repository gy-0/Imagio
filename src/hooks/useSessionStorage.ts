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

    const saveWithFallback = (sessionsToSave: AppSession[], attemptNumber: number = 1): boolean => {
      try {
        // Clean up blob URLs before saving (they won't be valid after restart)
        const sanitizedSessions = sessionsToSave.map(session => ({
          ...session,
          generation: {
            ...session.generation,
            // Don't persist local blob URLs, only remote URLs
            generatedImageUrl: ''
          }
        }));

        const jsonString = JSON.stringify(sanitizedSessions);
        const sizeInBytes = new Blob([jsonString]).size;
        const sizeInKB = (sizeInBytes / 1024).toFixed(2);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, jsonString);
          console.log(`Saved ${sessionsToSave.length} sessions (${sizeInKB} KB)`);
        }
        return true;
      } catch (error) {
        // Handle quota exceeded errors with multi-level fallback
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          const fallbackCounts = [25, 10, 5, 2];

          if (attemptNumber <= fallbackCounts.length) {
            const targetCount = fallbackCounts[attemptNumber - 1];
            console.warn(
              `localStorage quota exceeded (attempt ${attemptNumber}). ` +
              `Reducing to ${targetCount} newest sessions...`
            );

            // Keep only newest sessions (sort by updatedAt descending)
            const newestSessions = [...sessionsToSave]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, targetCount);

            return saveWithFallback(newestSessions, attemptNumber + 1);
          } else {
            console.error(
              'localStorage quota still exceeded after all fallback attempts. ' +
              'Unable to save sessions. Consider clearing browser data.'
            );
            return false;
          }
        } else {
          console.error('Failed to persist sessions:', error);
          return false;
        }
      }
    };

    try {
      // Limit the number of sessions to prevent localStorage quota issues
      // Sort by updatedAt to keep most recently used sessions
      const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
      const sessionsToSave = sortedSessions.slice(0, MAX_SESSIONS);

      saveWithFallback(sessionsToSave);
    } catch (error) {
      console.error('Unexpected error in session storage:', error);
    }
  }, [sessions, isLoading]);

  return {
    sessions,
    setSessions,
    isLoading
  };
};
