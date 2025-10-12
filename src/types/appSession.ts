import type { OcrSessionSnapshot } from '../features/ocr/useOcrProcessing';
import type { PromptSessionSnapshot } from '../features/promptOptimization/usePromptOptimization';
import type { ImageGenerationSessionSnapshot } from '../features/imageGeneration/useImageGeneration';

export type SessionSource = 'file' | 'drop' | 'screenshot';

export interface AppSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  source: SessionSource;
  ocr: OcrSessionSnapshot;
  prompt: PromptSessionSnapshot;
  generation: ImageGenerationSessionSnapshot;
}
