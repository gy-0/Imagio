import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LLM_SETTINGS } from '../features/promptOptimization/constants';
import type { LLMSettings, LocalConfig } from '../features/promptOptimization/types';

type UpdateLLMSetting<T extends keyof LLMSettings> = (key: T, value: LLMSettings[T]) => void;

export const useApplicationConfig = () => {
  const [llmSettings, setLLMSettings] = useState<LLMSettings>(DEFAULT_LLM_SETTINGS);
  const [bflApiKey, setBflApiKey] = useState<string>('');
  const [configError, setConfigError] = useState<string>('');
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadLocalConfig = async () => {
      try {
        const response = await fetch('/config.local.json', { cache: 'no-store' });
        if (!response.ok) {
          if (response.status !== 404) {
            console.warn(`Failed to load local config: ${response.statusText}`);
          }
          return;
        }

        const parsed: LocalConfig = await response.json();
        const overrides: Partial<LLMSettings> = {
          ...(parsed.llm ?? {})
        };

        const ensureNumber = (value: unknown): number | undefined => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
          }
          if (typeof value === 'string' && value.trim() !== '') {
            const numeric = Number(value);
            if (Number.isFinite(numeric)) {
              return numeric;
            }
          }
          return undefined;
        };

        if (parsed.apiBaseUrl) overrides.apiBaseUrl = parsed.apiBaseUrl;
        if (parsed.apiKey) overrides.apiKey = parsed.apiKey;
        if (parsed.modelName) overrides.modelName = parsed.modelName;

        const temp = ensureNumber(parsed.temperature ?? overrides.temperature);
        if (temp !== undefined) overrides.temperature = temp;

        if (!isMounted) {
          return;
        }

        if (Object.keys(overrides).length > 0) {
          setLLMSettings(prev => ({ ...prev, ...overrides }));
        }

        if (parsed.bflApiKey) {
          setBflApiKey(parsed.bflApiKey);
        }
      } catch (error) {
        console.error('Error loading local config:', error);
        if (error instanceof Error) {
          setConfigError(error.message);
        }
      } finally {
        if (isMounted) {
          setIsConfigLoading(false);
        }
      }
    };

    void loadLocalConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateLLMSetting = useCallback<UpdateLLMSetting<keyof LLMSettings>>((key, value) => {
    setLLMSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    llmSettings,
    updateLLMSetting,
    bflApiKey,
    setBflApiKey,
    configError,
    isConfigLoading
  };
};
