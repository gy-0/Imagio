import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callChatCompletionStream } from '../../utils/llmClient';
import type { ProcessingParams, OcrResult, TextDisplayMode } from './types';
import type { LLMSettings } from '../promptOptimization/types';
import { getTauriApis } from '../../utils/tauri-api';

interface UseOcrProcessingOptions {
  onTextChange?: (text: string) => void;
  onNewImage?: () => void;
  llmSettings?: LLMSettings;
}

const DEFAULT_PARAMS: ProcessingParams = {
  contrast: 1.3,
  brightness: 0.0,
  sharpness: 1.2,
  useAdaptiveThreshold: true,
  useClahe: true,
  gaussianBlur: 0.5,
  bilateralFilter: false,
  morphology: 'none',
  language: 'eng'
};

const reflowOcrText = (text: string): string => {
  // Replace single newlines with spaces, but preserve paragraph breaks (double newlines)
  // Use regex to match single newlines not followed/preceded by another newline
  return text.replace(/(?<!\n)\n(?!\n)/g, ' ');
};

export const useOcrProcessing = (options: UseOcrProcessingOptions = {}) => {
  const { onTextChange, onNewImage, llmSettings } = options;

  // Tauri API state
  const [tauriApis, setTauriApis] = useState<any>(null);
  const [apisLoaded, setApisLoaded] = useState<boolean>(false);

  // Load Tauri APIs on mount
  useEffect(() => {
    getTauriApis().then((apis) => {
      setTauriApis(apis);
      setApisLoaded(true);
    }).catch((error) => {
      console.error('Failed to load Tauri APIs:', error);
      setApisLoaded(true); // Still set to true to avoid infinite loading
    });
  }, []);

  const [imagePath, setImagePath] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [optimizedText, setOptimizedText] = useState<string>('');
  const [isOptimizingText, setIsOptimizingText] = useState<boolean>(false);
  const [textDisplayMode, setTextDisplayMode] = useState<TextDisplayMode>('original');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const isProcessingRef = useRef(false);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [params, setParams] = useState<ProcessingParams>(DEFAULT_PARAMS);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const resetProcessedPreview = useCallback(() => {
    setProcessedImageUrl('');
  }, []);

  const updateParam = useCallback((key: keyof ProcessingParams, value: number | boolean | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateOcrText = useCallback((value: string) => {
    setOcrText(value);
    onTextChange?.(value);
  }, [onTextChange]);

  const optimizeOcrText = useCallback(async () => {
    if (!ocrText.trim() || !llmSettings) {
      return;
    }

    setIsOptimizingText(true);
    setOptimizedText(''); // Clear previous optimized text
    setTextDisplayMode('optimized'); // Immediately switch to optimized view
    
    try {
      let accumulatedText = '';
      
      await callChatCompletionStream({
        baseUrl: llmSettings.apiBaseUrl,
        model: llmSettings.modelName,
        apiKey: llmSettings.apiKey,
        temperature: llmSettings.temperature,
        maxTokens: 8000,
        reasoningEffort: 'minimal', // Minimize reasoning for faster, cheaper OCR correction
        messages: [
          {
            role: 'system',
            content: 'Clean and correct OCR text errors. Remove invalid characters, fix common OCR mistakes, keep original meaning. Return only the corrected text.'
          },
          {
            role: 'user',
            content: ocrText
          }
        ]
      }, (chunk) => {
        if (!chunk.isDone && chunk.content) {
          accumulatedText += chunk.content;
          setOptimizedText(accumulatedText);
        }
      });
    } catch (error) {
      console.error('Error optimizing OCR text:', error);
      setOptimizedText(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsOptimizingText(false);
    }
  }, [ocrText, llmSettings]);

  const clearOptimizedText = useCallback(() => {
    setOptimizedText('');
    setTextDisplayMode('original');
  }, []);

  const performOcrOnPath = useCallback(async (path: string) => {
    if (!apisLoaded || !tauriApis) {
      console.warn('Tauri APIs not loaded yet');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Loading image...');

    try {
      setProcessingStatus('Preprocessing image...');
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await tauriApis.invoke('perform_ocr', {
        imagePath: path,
        params
      });

      setProcessingStatus('Extracting text...');
      const reflowedText = reflowOcrText(result.text);
      setOcrText(reflowedText);
      onTextChange?.(reflowedText);

      const processedUrl = tauriApis.convertFileSrc(result.processedImagePath);
      setProcessedImageUrl(processedUrl);
      setProcessingStatus('Complete!');
    } catch (error) {
      console.error('Error performing OCR:', error);
      setProcessingStatus('Error occurred');
      const message = error instanceof Error ? error.message : String(error);
      setOcrText(`Error: ${message}`);
      onTextChange?.(`Error: ${message}`);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 500);
    }
  }, [apisLoaded, tauriApis, onTextChange, params]);

  const selectImage = useCallback(async () => {
    if (!apisLoaded || !tauriApis) {
      console.warn('Tauri APIs not loaded yet');
      return;
    }

    try {
      const selected = await tauriApis.open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp']
        }]
      });

      if (!selected) {
        return;
      }

      const path = selected as string;
      setImagePath(path);
      resetProcessedPreview();
      setOcrText('');
      clearOptimizedText();
      onTextChange?.('');
      onNewImage?.();

      const assetUrl = tauriApis.convertFileSrc(path);
      setImagePreviewUrl(assetUrl);

      await performOcrOnPath(path);
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  }, [apisLoaded, tauriApis, performOcrOnPath, onNewImage, onTextChange, resetProcessedPreview, clearOptimizedText]);

  const takeScreenshot = useCallback(async () => {
    if (!apisLoaded || !tauriApis) {
      console.warn('Tauri APIs not loaded yet');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Taking screenshot...');

    try {
      const result = await tauriApis.invoke('take_screenshot');
      setImagePath(result.path);
      resetProcessedPreview();
      setOcrText('');
      clearOptimizedText();
      onTextChange?.('');
      onNewImage?.();

      const assetUrl = tauriApis.convertFileSrc(result.path);
      setImagePreviewUrl(assetUrl);
      setProcessingStatus('Processing image...');

      await performOcrOnPath(result.path);
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Error: ' + error);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  }, [apisLoaded, tauriApis, onNewImage, onTextChange, performOcrOnPath, resetProcessedPreview, clearOptimizedText]);

  const performOCR = useCallback(async () => {
    if (!imagePath) {
      return;
    }
    await performOcrOnPath(imagePath);
  }, [imagePath, performOcrOnPath]);

  const copyOcrText = useCallback(async () => {
    if (!ocrText.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(ocrText);
    } catch (error) {
      console.error('Failed to copy OCR text', error);
    }
  }, [ocrText]);

  const saveOcrText = useCallback(async () => {
    if (!apisLoaded || !tauriApis) {
      console.warn('Tauri APIs not loaded yet');
      return;
    }

    if (!ocrText.trim()) {
      return;
    }

    try {
      const filePath = await tauriApis.save({
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }],
        defaultPath: 'ocr_result.txt'
      });

      if (!filePath) {
        return;
      }

      await tauriApis.invoke('save_text_to_path', { text: ocrText, filePath });
    } catch (error) {
      console.error('Error saving text:', error);
      alert('Error: ' + error);
    }
  }, [apisLoaded, tauriApis, ocrText]);

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (!apisLoaded || !tauriApis) {
      console.warn('Tauri APIs not loaded yet');
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (!imageFile) {
      return;
    }

    try {
      // In browser, create a mock path and store the file
      const mockPath = `/dropped/${imageFile.name}`;
      (window as any).__mockFiles = (window as any).__mockFiles || {};
      (window as any).__mockFiles[mockPath] = imageFile;

      // Create data URL for preview
      const reader = new FileReader();
      reader.onload = async (event) => {
        (window as any).__mockFiles[mockPath].dataUrl = event.target?.result;

        setImagePath(mockPath);
        resetProcessedPreview();
        setOcrText('');
        clearOptimizedText();
        onTextChange?.('');
        onNewImage?.();

        const assetUrl = tauriApis.convertFileSrc(mockPath);
        setImagePreviewUrl(assetUrl);

        await performOcrOnPath(mockPath);
      };
      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('Error handling dropped file:', error);
    }
  }, [apisLoaded, tauriApis, onNewImage, onTextChange, performOcrOnPath, resetProcessedPreview, clearOptimizedText]);

  useEffect(() => {
    if (!imagePath || isProcessingRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (!isProcessingRef.current) {
        void performOcrOnPath(imagePath);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [imagePath, params, performOcrOnPath]);

  const dragAndDropHandlers = useMemo(() => ({
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop
  }), [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return {
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    updateOcrText,
    optimizedText,
    isOptimizingText,
    textDisplayMode,
    setTextDisplayMode,
    optimizeOcrText,
    clearOptimizedText,
    isProcessing,
    processingStatus,
    params,
    updateParam,
    selectImage,
    takeScreenshot,
    performOCR,
    copyOcrText,
    saveOcrText,
    isDragging,
    dragAndDropHandlers
  };
};
