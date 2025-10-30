import type { AppSession } from '../types/appSession';

export type SortOption = 'createdAt' | 'updatedAt';

/**
 * Sort sessions by the specified criteria
 */
export const sortSessions = (sessions: AppSession[], sortBy: SortOption): AppSession[] => {
  return [...sessions].sort((a, b) => b[sortBy] - a[sortBy]);
};

/**
 * Insert session maintaining sort order - O(n) instead of O(n log n)
 */
export const insertSessionSorted = (
  sessions: AppSession[],
  newSession: AppSession,
  sortBy: SortOption
): AppSession[] => {
  const sortValue = newSession[sortBy];
  let insertIndex = 0;

  // Find insertion point (sessions are sorted descending)
  while (insertIndex < sessions.length && sessions[insertIndex][sortBy] > sortValue) {
    insertIndex++;
  }

  const result = [...sessions];
  result.splice(insertIndex, 0, newSession);
  return result;
};

/**
 * Update session and reposition if needed - avoids full sort
 */
export const updateSessionInPlace = (
  sessions: AppSession[],
  sessionId: string,
  updater: (session: AppSession) => AppSession,
  sortBy: SortOption
): AppSession[] => {
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return sessions;

  const updated = updater(sessions[index]);
  const newSortValue = updated[sortBy];

  // Check if position needs to change
  const needsReposition =
    (index > 0 && sessions[index - 1][sortBy] < newSortValue) ||
    (index < sessions.length - 1 && sessions[index + 1][sortBy] > newSortValue);

  if (!needsReposition) {
    // Simple in-place update
    const result = [...sessions];
    result[index] = updated;
    return result;
  }

  // Remove and reinsert
  const withoutSession = sessions.filter(s => s.id !== sessionId);
  return insertSessionSorted(withoutSession, updated, sortBy);
};

/**
 * Generate a unique session ID
 */
export const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Derive session title from file path and source
 */
export const deriveSessionTitle = (path: string, source: 'file' | 'drop' | 'screenshot'): string => {
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
};

