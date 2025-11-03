import { SettingsModal } from '../../../components/SettingsModal';
import type { LLMSettings } from '../../../features/promptOptimization/types';
import type { ProcessingParams } from '../../../features/ocr/types';
import type { ImageGenModel } from '../../../features/promptOptimization/types';

interface SettingsContainerProps {
  // Modal control
  isOpen: boolean;
  onClose: () => void;

  // LLM settings
  llmSettings: LLMSettings;
  onLLMSettingChange: (key: string, value: unknown) => void;

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
  onProcessingParamChange: (key: string, value: number | boolean | string) => void;
}

/**
 * Container component for settings modal
 * Serves as a bridge between App.tsx and SettingsModal
 * In the future, this can manage additional state or perform side effects
 */
export const SettingsContainer = (props: SettingsContainerProps) => {
  return <SettingsModal {...props} />;
};
