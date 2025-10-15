export interface ProcessingParams {
  contrast: number;
  brightness: number;
  sharpness: number;
  useAdaptiveThreshold: boolean;
  useClahe: boolean;
  gaussianBlur: number;
  bilateralFilter: boolean;
  morphology: string;
  language: string;
  correctSkew: boolean;  // 倾斜校正
}

export interface OcrResult {
  text: string;
  processedImagePath: string;
}

export type TextDisplayMode = 'original' | 'optimized';
