/**
 * Session Management Types
 * Defines the data structures for multi-image sessions and history
 */

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  
  // Image information
  imagePath: string;
  imagePreviewUrl: string | null;
  
  // OCR results
  ocrText: string;
  optimizedOcrText: string;
  processedImageUrl: string | null;
  
  // Prompt optimization
  imageStyle: string;
  customDescription: string;
  optimizedPrompt: string;
  
  // Image generation
  generatedImageUrl: string | null;
  generatedImageRemoteUrl: string | null;
  aspectRatio: '1:1' | '16:9' | '9:16';
  
  // Processing status
  isProcessingOcr: boolean;
  isOptimizingText: boolean;
  isOptimizingPrompt: boolean;
  isGeneratingImage: boolean;
}

export interface AppSettings {
  // Automation settings
  autoOptimizeOcr: boolean;
  autoGeneratePrompt: boolean;
  autoGenerateImage: boolean;
  autoSaveImage: boolean;
  
  // UI settings
  sidebarCollapsed: boolean;
  
  // LLM settings (stored separately in useApplicationConfig)
  // Image generation settings (stored separately in useImageGeneration)
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoOptimizeOcr: false,
  autoGeneratePrompt: false,
  autoGenerateImage: false,
  autoSaveImage: false,
  sidebarCollapsed: false,
};

export interface SessionListItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  imagePath: string;
  thumbnailUrl?: string;
}

export const createEmptySession = (imagePath: string = ''): Session => {
  const timestamp = Date.now();
  return {
    id: `session_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
    name: imagePath ? `Session ${new Date(timestamp).toLocaleString()}` : 'New Session',
    createdAt: timestamp,
    updatedAt: timestamp,
    imagePath,
    imagePreviewUrl: null,
    ocrText: '',
    optimizedOcrText: '',
    processedImageUrl: null,
    imageStyle: 'flux',
    customDescription: '',
    optimizedPrompt: '',
    generatedImageUrl: null,
    generatedImageRemoteUrl: null,
    aspectRatio: '1:1',
    isProcessingOcr: false,
    isOptimizingText: false,
    isOptimizingPrompt: false,
    isGeneratingImage: false,
  };
};
