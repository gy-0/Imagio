export interface ProcessingParams {
  contrast: number;
  brightness: number;
  sharpness: number;
  binarizationMethod: string;  // "none" | "adaptive" | "otsu" | "mean"
  useClahe: boolean;
  gaussianBlur: number;
  bilateralFilter: boolean;
  morphology: string;  // "none" | "erode" | "dilate" | "opening" | "closing"
  language: string;
  correctSkew: boolean;  // 倾斜校正
}

export interface OcrResult {
  text: string;
  processedImagePath: string;
}

export type TextDisplayMode = 'original' | 'optimized';
