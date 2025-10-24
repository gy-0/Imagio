import { useEffect, useCallback } from 'react';

// Keyboard shortcut configuration
export interface ShortcutConfig {
  key: string;
  ctrlOrCmd: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'file' | 'edit' | 'view' | 'general';
}

export const KEYBOARD_SHORTCUTS: Record<string, ShortcutConfig> = {
  selectImage: {
    key: 'o',
    ctrlOrCmd: true,
    description: 'Open image file',
    category: 'file',
  },
  takeScreenshot: {
    key: 's',
    ctrlOrCmd: true,
    shift: true,
    description: 'Take screenshot',
    category: 'file',
  },
  performOcr: {
    key: 'Enter',
    ctrlOrCmd: true,
    description: 'Perform OCR',
    category: 'edit',
  },
  copyText: {
    key: 'c',
    ctrlOrCmd: true,
    description: 'Copy OCR text',
    category: 'edit',
  },
  saveText: {
    key: 's',
    ctrlOrCmd: true,
    description: 'Save OCR text',
    category: 'file',
  },
  toggleAdvanced: {
    key: 'a',
    ctrlOrCmd: true,
    description: 'Toggle advanced settings',
    category: 'view',
  },
  openSettings: {
    key: ',',
    ctrlOrCmd: true,
    description: 'Open settings',
    category: 'general',
  },
  closeModal: {
    key: 'Escape',
    ctrlOrCmd: false,
    description: 'Close modal/dialog',
    category: 'general',
  },
};

interface KeyboardShortcutHandlers {
  onSelectImage: () => void;
  onTakeScreenshot: () => void;
  onPerformOcr: () => void;
  onCopyText: () => void;
  onSaveText: () => void;
  onToggleAdvanced: () => void;
  onOpenSettings: () => void;
  onCloseModal?: () => void;
  canPerformOcr: boolean;
  hasOcrText: boolean;
}

/**
 * Custom hook for managing keyboard shortcuts throughout the application.
 * Provides consistent keyboard navigation and action triggers.
 */
export const useKeyboardShortcuts = ({
  onSelectImage,
  onTakeScreenshot,
  onPerformOcr,
  onCopyText,
  onSaveText,
  onToggleAdvanced,
  onOpenSettings,
  onCloseModal,
  canPerformOcr,
  hasOcrText,
}: KeyboardShortcutHandlers) => {
  // Memoize the handler to prevent unnecessary re-renders
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { metaKey, ctrlKey, shiftKey, altKey } = event;
      const key = event.key;
      const isCtrlOrCmd = metaKey || ctrlKey;

      // Helper function to check if shortcut matches
      const matchesShortcut = (config: ShortcutConfig): boolean => {
        const keyMatches = key.toLowerCase() === config.key.toLowerCase();
        const modifierMatches = config.ctrlOrCmd ? isCtrlOrCmd : !isCtrlOrCmd;
        const shiftMatches = config.shift ? shiftKey : true;
        const altMatches = config.alt ? altKey : true;
        return keyMatches && modifierMatches && shiftMatches && altMatches;
      };

      // Check for text input focus - allow native shortcuts in input fields
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;

      // Escape key - always allow to close modals
      if (key === 'Escape' && onCloseModal) {
        event.preventDefault();
        onCloseModal();
        return;
      }

      // Settings shortcut - always available
      if (matchesShortcut(KEYBOARD_SHORTCUTS.openSettings)) {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      // Don't intercept shortcuts in input fields except for specific cases
      if (isInputField) {
        // Allow Cmd/Ctrl+Enter for OCR even in input fields
        if (matchesShortcut(KEYBOARD_SHORTCUTS.performOcr) && canPerformOcr) {
          event.preventDefault();
          onPerformOcr();
        }
        return;
      }

      // File operations
      if (matchesShortcut(KEYBOARD_SHORTCUTS.selectImage)) {
        event.preventDefault();
        onSelectImage();
        return;
      }

      if (matchesShortcut(KEYBOARD_SHORTCUTS.takeScreenshot)) {
        event.preventDefault();
        onTakeScreenshot();
        return;
      }

      // Edit operations - only when conditions are met
      if (matchesShortcut(KEYBOARD_SHORTCUTS.performOcr) && canPerformOcr) {
        event.preventDefault();
        onPerformOcr();
        return;
      }

      // Copy text - only if there's OCR text and no text selection
      if (matchesShortcut(KEYBOARD_SHORTCUTS.copyText) && hasOcrText) {
        const selection = window.getSelection();
        if (!selection || !selection.toString()) {
          event.preventDefault();
          onCopyText();
        }
        return;
      }

      // Save text - only if there's OCR text
      if (matchesShortcut(KEYBOARD_SHORTCUTS.saveText) && hasOcrText) {
        event.preventDefault();
        onSaveText();
        return;
      }

      // Toggle advanced - only when no OCR text (to avoid conflict with save)
      if (matchesShortcut(KEYBOARD_SHORTCUTS.toggleAdvanced) && !hasOcrText) {
        event.preventDefault();
        onToggleAdvanced();
      }
    },
    [
      onSelectImage,
      onTakeScreenshot,
      onPerformOcr,
      onCopyText,
      onSaveText,
      onToggleAdvanced,
      onOpenSettings,
      onCloseModal,
      canPerformOcr,
      hasOcrText,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Utility function to format shortcut display text
 */
export const formatShortcutDisplay = (config: ShortcutConfig): string => {
  const parts: string[] = [];
  
  if (config.ctrlOrCmd) {
    parts.push(navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl');
  }
  if (config.shift) {
    parts.push('⇧');
  }
  if (config.alt) {
    parts.push(navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌥' : 'Alt');
  }
  
  // Format key name
  const keyName = config.key.length === 1 
    ? config.key.toUpperCase() 
    : config.key.charAt(0).toUpperCase() + config.key.slice(1);
  parts.push(keyName);
  
  return parts.join(' + ');
};
