import { useCallback, useRef } from 'react';
import { OverlaySidebar } from '../../../components/OverlaySidebar';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists as fsExists, remove as fsRemove } from '@tauri-apps/plugin-fs';
import type { AppSession } from '../../../types/appSession';
import type { SortOption } from '../../../utils/sessionUtils';
import type { AutomationSettings } from '../../../hooks/useAutomationSettings';

interface SidebarContainerProps {
  isOpen: boolean;
  onClose: () => void;

  // Automation settings
  automationSettings: AutomationSettings;
  onAutomationSettingChange: <K extends keyof AutomationSettings>(
    key: K,
    value: AutomationSettings[K]
  ) => void;

  // Sessions
  sessions: AppSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onSessionsChange: (sessions: AppSession[]) => void;

  // Sorting
  sortBy: SortOption;
  onSortByChange: (sortBy: SortOption) => void;

  // Settings
  onOpenSettings: () => void;
}

/**
 * Container component for sidebar functionality
 * Handles all sidebar logic including sessions, automation settings, and directory selection
 */
export const SidebarContainer = ({
  isOpen,
  onClose,
  automationSettings,
  onAutomationSettingChange,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onSessionsChange,
  sortBy,
  onSortByChange,
  onOpenSettings
}: SidebarContainerProps) => {
  const isRestoringSessionRef = useRef<boolean>(false);

  /**
   * Handle auto-save directory selection
   */
  const handleSelectAutoSaveDirectory = useCallback(async () => {
    try {
      const selectedPath = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Auto-Save Directory'
      });

      if (selectedPath && typeof selectedPath === 'string') {
        onAutomationSettingChange('autoSaveDirectory', selectedPath);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  }, [onAutomationSettingChange]);

  /**
   * Handle session selection with restoration of state
   */
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      // If already active, just close sidebar
      if (sessionId === activeSessionId) {
        onClose();
        return;
      }

      // Find the session
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        console.error('Session not found:', sessionId);
        return;
      }

      // Prevent duplicate restoration
      if (isRestoringSessionRef.current) {
        return;
      }

      isRestoringSessionRef.current = true;

      try {
        // Update timestamp
        const updatedSession: AppSession = {
          ...session,
          updatedAt: Date.now()
        };

        const updatedSessions = sessions.map(s => (s.id === sessionId ? updatedSession : s));
        onSessionsChange(updatedSessions);

        // Restore the session (let parent handle the actual restoration)
        onSelectSession(sessionId);

        // Close sidebar after selection
        onClose();
      } finally {
        isRestoringSessionRef.current = false;
      }
    },
    [sessions, activeSessionId, onSelectSession, onSessionsChange, onClose]
  );

  /**
   * Handle session deletion with cleanup
   */
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        return;
      }

      // Delete associated image file if exists
      if (session.generation?.generatedImageLocalPath) {
        try {
          const fileExists = await fsExists(session.generation.generatedImageLocalPath);
          if (fileExists) {
            await fsRemove(session.generation.generatedImageLocalPath);
          }
        } catch (error) {
          console.warn('Failed to delete generated image file:', session.generation.generatedImageLocalPath, error);
        }
      }

      // Remove from sessions list
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      onSessionsChange(updatedSessions);

      // Clear active session if it was deleted (no need to call onSelectSession with null)
      if (activeSessionId === sessionId) {
        onDeleteSession(sessionId);
      } else {
        // Call parent's delete handler for any additional cleanup
        onDeleteSession(sessionId);
      }
    },
    [sessions, activeSessionId, onSessionsChange, onDeleteSession]
  );

  return (
    <OverlaySidebar
      isOpen={isOpen}
      onClose={onClose}
      automationSettings={automationSettings}
      onAutomationSettingChange={onAutomationSettingChange}
      onSelectAutoSaveDirectory={handleSelectAutoSaveDirectory}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleDeleteSession}
      onOpenSettings={onOpenSettings}
      sortBy={sortBy}
      onSortByChange={onSortByChange}
    />
  );
};
