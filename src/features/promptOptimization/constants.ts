import type { LLMSettings } from './types';

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4o-mini',
  temperature: 0.7
};
