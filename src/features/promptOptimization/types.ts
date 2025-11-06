export interface LLMSettings {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
}

// Unified image generation model type
export type ImageGenModel =
  // BLTCY models (no provider suffix)
  | 'flux-dev'
  | 'flux-pro'
  | 'nano-banana'
  | 'nano-banana-hd'
  | 'dall-e-3'
  | 'recraftv3'
  | 'qwen-image'
  | 'flux-kontext-pro'
  | 'gpt-image-1'
  | 'gpt-4o-image'
  | 'sora-image'
  | 'doubao-seedream-4-0'
  | 'doubao-seededit-3-0'
  | 'doubao-seedream-3-0'
  // Official provider models (with provider suffix)
  | 'flux-bfl'
  | 'nano-banana-gemini'
  // Midjourney models
  | 'midjourney-fast'
  | 'midjourney-relax';

export interface LocalConfig {
  llm?: Partial<LLMSettings>;
  apiBaseUrl?: string;
  apiKey?: string;
  modelName?: string;
  temperature?: number;
  bflApiKey?: string;
  geminiApiKey?: string;
  bltcyApiKey?: string;
  selectedModel?: ImageGenModel;
}
