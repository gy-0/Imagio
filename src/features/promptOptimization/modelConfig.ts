/**
 * Image Generation Model Configuration
 * Maps model IDs to their display names and provider information
 */

import type { ImageGenModel } from './types';

export interface ModelInfo {
  id: ImageGenModel;
  displayName: string;
  provider: 'bltcy' | 'bfl' | 'gemini' | 'midjourney';
  apiModel?: string; // The actual model name to send to the API (if different from id)
}

export const IMAGE_GEN_MODELS: ModelInfo[] = [
  // BLTCY models (no provider suffix in display)
  // Note: flux-dev and flux-pro use BFL proxy format (supports aspect_ratio)
  { id: 'flux-dev', displayName: 'FLUX-DEV', provider: 'bltcy', apiModel: 'flux-dev' },
  { id: 'flux-pro', displayName: 'FLUX-Pro', provider: 'bltcy', apiModel: 'flux-pro' },
  { id: 'nano-banana', displayName: 'Nano Banana🍌', provider: 'bltcy', apiModel: 'nano-banana' },
  { id: 'nano-banana-hd', displayName: 'Nano Banana HD🍌', provider: 'bltcy', apiModel: 'nano-banana-hd' },
  { id: 'dall-e-3', displayName: 'DALL-E 3', provider: 'bltcy', apiModel: 'dall-e-3' },
  { id: 'recraftv3', displayName: 'Recraft v3', provider: 'bltcy', apiModel: 'recraftv3' },
  { id: 'qwen-image', displayName: 'Qwen Image', provider: 'bltcy', apiModel: 'qwen-image' },
  { id: 'flux-kontext-pro', displayName: 'FLUX Kontext Pro', provider: 'bltcy', apiModel: 'flux-kontext-pro' },
  { id: 'gpt-image-1', displayName: 'GPT Image 1', provider: 'bltcy', apiModel: 'gpt-image-1' },
  { id: 'gpt-4o-image', displayName: 'GPT-4o Image', provider: 'bltcy', apiModel: 'gpt-4o-image' },
  { id: 'sora-image', displayName: 'Sora Image', provider: 'bltcy', apiModel: 'sora_image' },
  { id: 'doubao-seedream-4-0', displayName: 'Doubao SeedDream 4.0', provider: 'bltcy', apiModel: 'doubao-seedream-4-0-250828' },
  { id: 'doubao-seededit-3-0', displayName: 'Doubao SeedEdit 3.0', provider: 'bltcy', apiModel: 'doubao-seededit-3-0-i2i-250628' },
  { id: 'doubao-seedream-3-0', displayName: 'Doubao SeedDream 3.0', provider: 'bltcy', apiModel: 'doubao-seedream-3-0-t2i-250415' },

  // Official provider models (with provider suffix in display)
  { id: 'flux-bfl', displayName: 'FLUX (BFL)', provider: 'bfl' },
  { id: 'nano-banana-gemini', displayName: 'Nano Banana🍌 (Gemini)', provider: 'gemini' },

  // Midjourney models
  { id: 'midjourney-fast', displayName: 'Midjourney Fast', provider: 'midjourney' },
  { id: 'midjourney-relax', displayName: 'Midjourney Relax', provider: 'midjourney' },
];

export const getModelInfo = (modelId: ImageGenModel): ModelInfo | undefined => {
  return IMAGE_GEN_MODELS.find(m => m.id === modelId);
};

export const getModelDisplayName = (modelId: ImageGenModel): string => {
  const model = getModelInfo(modelId);
  return model?.displayName || modelId;
};

export const getModelProvider = (modelId: ImageGenModel): 'bltcy' | 'bfl' | 'gemini' | 'midjourney' => {
  const model = getModelInfo(modelId);
  return model?.provider || 'bltcy';
};

export const getApiModelName = (modelId: ImageGenModel): string => {
  const model = getModelInfo(modelId);
  return model?.apiModel || modelId;
};
