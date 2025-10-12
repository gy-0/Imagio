import type { DragEvent, MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { callChatCompletionStream } from '../../utils/llmClient';
import type { ProcessingParams, OcrResult, TextDisplayMode } from './types';
import type { LLMSettings } from '../promptOptimization/types';

interface UseOcrProcessingOptions {
  onTextChange?: (text: string) => void;
  onNewImage?: (details: { path: string; previewUrl: string; source: 'file' | 'drop' | 'screenshot'; }) => void;
  llmSettings?: LLMSettings;
  suppressAutoProcessRef?: MutableRefObject<boolean>;
}

export interface OcrSessionSnapshot {
  imagePath: string;
  imagePreviewUrl: string;
  processedImageUrl: string;
  ocrText: string;
  optimizedText: string;
  textDisplayMode: TextDisplayMode;
}

const DEFAULT_PARAMS: ProcessingParams = {
  contrast: 1.3,
  brightness: 0.0,
  sharpness: 1.2,
  useAdaptiveThreshold: false,
  useClahe: false,
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
  const { onTextChange, onNewImage, llmSettings, suppressAutoProcessRef } = options;

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
    setIsProcessing(true);
    setProcessingStatus('Loading image...');

    try {
      setProcessingStatus('Preprocessing image...');
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await invoke<OcrResult>('perform_ocr', {
        imagePath: path,
        params
  });

      setProcessingStatus('Extracting text...');
      const reflowedText = reflowOcrText(result.text);
      setOcrText(reflowedText);
      onTextChange?.(reflowedText);

      const processedUrl = convertFileSrc(result.processedImagePath);
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
  }, [onTextChange, params]);

  const processImageAtPath = useCallback(async (path: string, source: 'file' | 'drop' | 'screenshot' = 'file') => {
    setImagePath(path);
    resetProcessedPreview();
    setOcrText('');
    clearOptimizedText();
    onTextChange?.('');

    const assetUrl = convertFileSrc(path);
    setImagePreviewUrl(assetUrl);
    onNewImage?.({ path, previewUrl: assetUrl, source });

    // Wait for OCR to complete before returning
    await performOcrOnPath(path);

    // Add a small delay to ensure state updates propagate
    await new Promise(resolve => setTimeout(resolve, 100));
  }, [clearOptimizedText, onNewImage, onTextChange, performOcrOnPath, resetProcessedPreview]);

  const processMultipleImages = useCallback(async (paths: string[], source: 'file' | 'drop' = 'file') => {
    for (const path of paths) {
      await processImageAtPath(path, source);
    }
  }, [processImageAtPath]);

  const selectImage = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp']
        }]
      });

      if (!selected) {
        return;
      }

      if (Array.isArray(selected)) {
        await processMultipleImages(selected, 'file');
        return;
      }

      await processImageAtPath(selected as string, 'file');
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  }, [processImageAtPath, processMultipleImages]);

  const takeScreenshot = useCallback(async () => {
    setIsProcessing(true);
    setProcessingStatus('Taking screenshot...');

    try {
      const result = await invoke<{ path: string; text: string }>('take_screenshot');
      await processImageAtPath(result.path, 'screenshot');
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Error: ' + error);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  }, [processImageAtPath]);

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
    if (!ocrText.trim()) {
      return;
    }

    try {
      const filePath = await save({
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }],
        defaultPath: 'ocr_result.txt'
      });

      if (!filePath) {
        return;
      }

      await invoke('save_text_to_path', { text: ocrText, filePath });
    } catch (error) {
      console.error('Error saving text:', error);
      alert('Error: ' + error);
    }
  }, [ocrText]);

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

    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      return;
    }

    try {
      const imagePaths = imageFiles.map(file => (file as any).path || file.name);
      await processMultipleImages(imagePaths, 'drop');
    } catch (error) {
      console.error('Error handling dropped file:', error);
    }
  }, [processMultipleImages]);

  useEffect(() => {
    if (suppressAutoProcessRef?.current) {
      return;
    }

    if (!imagePath || isProcessingRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (!isProcessingRef.current) {
        void performOcrOnPath(imagePath);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [imagePath, params, performOcrOnPath, suppressAutoProcessRef]);

  const dragAndDropHandlers = useMemo(() => ({
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop
  }), [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const getSessionSnapshot = useCallback((): OcrSessionSnapshot => ({
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    optimizedText,
    textDisplayMode
  }), [imagePath, imagePreviewUrl, processedImageUrl, ocrText, optimizedText, textDisplayMode]);

  const loadSessionSnapshot = useCallback((snapshot: OcrSessionSnapshot) => {
    setImagePath(snapshot.imagePath);
    setImagePreviewUrl(snapshot.imagePreviewUrl);
    setProcessedImageUrl(snapshot.processedImageUrl);
    setOcrText(snapshot.ocrText);
    setOptimizedText(snapshot.optimizedText);
    setTextDisplayMode(snapshot.textDisplayMode);
  }, []);

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
    dragAndDropHandlers,
    processImageAtPath,
    getSessionSnapshot,
    loadSessionSnapshot
  };
};
