import { useCallback, useEffect, useRef, useState } from 'react';
import { homeDir, join } from '@tauri-apps/api/path';

export interface AutomationSettings {
  autoOptimizeOcr: boolean;
  autoGeneratePrompt: boolean;
  autoGenerateImage: boolean;
  autoSaveImage: boolean;
  autoSaveDirectory: string;
}

interface UseAutomationSettingsResult {
  settings: AutomationSettings;
  updateSetting: <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => void;
  isLoading: boolean;
}

const STORAGE_KEY = 'imagio-automation-settings';
const DEFAULT_SETTINGS: AutomationSettings = {
  autoOptimizeOcr: false,
  autoGeneratePrompt: false,
  autoGenerateImage: false,
  autoSaveImage: false,
  autoSaveDirectory: ''
};

export const useAutomationSettings = (): UseAutomationSettingsResult => {
  const [settings, setSettings] = useState<AutomationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasLoadedFromStorageRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const stored = typeof window !== 'undefined'
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;

        if (stored) {
          const parsed = JSON.parse(stored) as Partial<AutomationSettings>;
          if (isMounted) {
            setSettings(prev => ({
              ...prev,
              ...parsed
            }));
            hasLoadedFromStorageRef.current = true;
          }
        }

        if (!hasLoadedFromStorageRef.current) {
          try {
            const home = await homeDir();
            const defaultDirectory = await join(home, 'Pictures', 'Imagio');
            if (isMounted) {
              setSettings(prev => ({
                ...prev,
                autoSaveDirectory: defaultDirectory
              }));
            }
          } catch (pathError) {
            console.warn('Failed to resolve default auto-save directory:', pathError);
          }
        }
      } catch (error) {
        console.error('Failed to load automation settings:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
    } catch (error) {
      console.error('Failed to persist automation settings:', error);
    }
  }, [settings, isLoading]);

  const updateSetting = useCallback(<K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  return {
    settings,
    updateSetting,
    isLoading
  };
};
