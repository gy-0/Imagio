import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  onSelectImage: () => void;
  onTakeScreenshot: () => void;
  onPerformOcr: () => void;
  onCopyText: () => void;
  onSaveText: () => void;
  onToggleAdvanced: () => void;
  onOpenSettings: () => void;
  canPerformOcr: boolean;
  hasOcrText: boolean;
}

export const useKeyboardShortcuts = ({
  onSelectImage,
  onTakeScreenshot,
  onPerformOcr,
  onCopyText,
  onSaveText,
  onToggleAdvanced,
  onOpenSettings,
  canPerformOcr,
  hasOcrText
}: KeyboardShortcutHandlers) => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
  const { metaKey, ctrlKey, shiftKey } = event;
  const key = event.key.toLowerCase();
      const isModifierActive = metaKey || ctrlKey;

      // Command+, or Ctrl+, to open settings
      if (isModifierActive && key === ',') {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      if (!isModifierActive) {
        return;
      }

  if (key === 'o') {
        event.preventDefault();
        onSelectImage();
        return;
      }

  if (shiftKey && key === 's') {
        event.preventDefault();
        onTakeScreenshot();
        return;
      }

  if (key === 'enter' && canPerformOcr) {
        event.preventDefault();
        onPerformOcr();
        return;
      }

  if (key === 'c' && hasOcrText) {
        const selection = window.getSelection();
        if (!selection || !selection.toString()) {
          event.preventDefault();
          onCopyText();
        }
        return;
      }

  if (key === 's' && hasOcrText) {
        event.preventDefault();
        onSaveText();
        return;
      }

  if (key === 'a' && !hasOcrText) {
        event.preventDefault();
        onToggleAdvanced();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    onSelectImage,
    onTakeScreenshot,
    onPerformOcr,
    onCopyText,
    onSaveText,
    onToggleAdvanced,
    onOpenSettings,
    canPerformOcr,
    hasOcrText
  ]);
};
