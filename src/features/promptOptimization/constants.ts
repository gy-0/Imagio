import type { LLMSettings } from './types';

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiBaseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: '',
  modelName: 'llama3.1:8b',
  temperature: 0.7
};
