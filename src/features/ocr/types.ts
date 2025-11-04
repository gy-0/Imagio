export interface ProcessingParams {
  contrast: number;
  brightness: number;
  sharpness: number;
  binarizationMethod: string;  // "none" | "adaptive" | "otsu" | "mean" | "sauvola"
  useClahe: boolean;
  gaussianBlur: number;
  bilateralFilter: boolean;
  morphology: string;  // "none" | "erode" | "dilate" | "opening" | "closing"
  language: string;
  correctSkew: boolean;  // Skew correction
  skewMethod: string;  // "hough" | "projection"
  removeBorders: boolean;  // Remove black borders
  adaptiveMode: boolean;  // Enable adaptive preprocessing
}

export interface ImageQualityMetrics {
  blurScore: number;        // 0-100, higher is sharper
  contrastScore: number;    // 0-100, higher is better
  noiseLevel: number;       // 0-100, lower is better
  brightnessLevel: number;  // 0-255, average brightness
}

export interface OcrResult {
  text: string;
  processedImagePath: string;
  qualityMetrics?: ImageQualityMetrics;
}

export type TextDisplayMode = 'original' | 'optimized';
