import { useState } from 'react';
import { SettingsModal } from '../../../components/SettingsModal';
import type { LLMSettings } from '../../../hooks/useApplicationConfig';
import type { ProcessingParams } from '../../../types/processingParams';
import type { ImageGenModel } from '../../../types/imageGenModels';

interface SettingsContainerProps {
  // Modal control
  isOpen: boolean;
  onClose: () => void;

  // LLM settings
  llmSettings: LLMSettings;
  onLLMSettingChange: <K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) => void;

  // API Keys
  bflApiKey: string;
  onBflApiKeyChange: (value: string) => void;
  geminiApiKey: string;
  onGeminiApiKeyChange: (value: string) => void;
  bltcyApiKey: string;
  onBltcyApiKeyChange: (value: string) => void;

  // Image generation model
  selectedModel: ImageGenModel;
  onSelectedModelChange: (value: ImageGenModel) => void;

  // OCR processing parameters
  processingParams: ProcessingParams;
  onProcessingParamChange: (key: keyof ProcessingParams, value: number | boolean | string) => void;
}

/**
 * Container component for settings modal
 * Serves as a bridge between App.tsx and SettingsModal
 * In the future, this can manage additional state or perform side effects
 */
export const SettingsContainer = (props: SettingsContainerProps) => {
  return <SettingsModal {...props} />;
};
