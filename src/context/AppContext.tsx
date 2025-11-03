import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AppSession } from '../types/appSession';
import type { SortOption } from '../utils/sessionUtils';

export interface AppContextType {
  // Session management
  sessions: AppSession[];
  setSessions: (sessions: AppSession[]) => void;
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  sortBy: SortOption;
  setSortBy: (sortBy: SortOption) => void;

  // UI state
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;

  // OCR state
  hasPerformedOcr: boolean;
  setHasPerformedOcr: (hasPerformed: boolean) => void;

  // Image generation state
  currentGenerationSessionId: string | null;
  setCurrentGenerationSessionId: (sessionId: string | null) => void;
  generatedImageOwnerSessionId: string | null;
  setGeneratedImageOwnerSessionId: (sessionId: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppContextProviderProps {
  children: ReactNode;
}

/**
 * Provider component for application-level state
 * Reduces prop drilling by centralizing state management
 */
export const AppContextProvider = ({ children }: AppContextProviderProps) => {
  // Session management
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('createdAt');

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // OCR state
  const [hasPerformedOcr, setHasPerformedOcr] = useState<boolean>(false);

  // Image generation state
  const [currentGenerationSessionId, setCurrentGenerationSessionId] = useState<string | null>(null);
  const [generatedImageOwnerSessionId, setGeneratedImageOwnerSessionId] = useState<string | null>(null);

  const value: AppContextType = {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    sortBy,
    setSortBy,
    isSidebarOpen,
    setIsSidebarOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    hasPerformedOcr,
    setHasPerformedOcr,
    currentGenerationSessionId,
    setCurrentGenerationSessionId,
    generatedImageOwnerSessionId,
    setGeneratedImageOwnerSessionId
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/**
 * Hook to use the app context
 * Throws error if used outside of AppContextProvider
 */
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
};
