import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { callChatCompletionStream } from '../../utils/llmClient';
import type { ProcessingParams, OcrResult, TextDisplayMode } from './types';
import type { LLMSettings } from '../promptOptimization/types';

interface UseOcrProcessingOptions {
  onTextChange?: (text: string) => void;
  onNewImage?: (details: { path: string; previewUrl: string; source: 'file' | 'drop' | 'screenshot'; }) => string;
  onOcrComplete?: (details: { imagePath: string; ocrText: string; processedImageUrl: string; }) => void;
  onOcrError?: (details: { imagePath: string; error: string; }) => void;
  onOptimizeComplete?: (details: { imagePath: string; optimizedText: string; }) => void;
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
  params: ProcessingParams;
}

const DEFAULT_PARAMS: ProcessingParams = {
  contrast: 1.3,
  brightness: 0.0,
  sharpness: 1.2,
  binarizationMethod: 'otsu',  // Use Otsu binarization
  useClahe: false,
  gaussianBlur: 0.5,
  bilateralFilter: false,
  morphology: 'none',
  language: 'eng',
  correctSkew: true,  // Enable skew correction by default
  skewMethod: 'projection',  // Use projection method (faster and more reliable)
  removeBorders: false,  // Don't remove borders by default
  adaptiveMode: false  // Don't use adaptive mode by default (manual control)
};

const reflowOcrText = (text: string): string => {
  // Replace single newlines with spaces, but preserve paragraph breaks (double newlines)
  // Use regex to match single newlines not followed/preceded by another newline
  return text.replace(/(?<!\n)\n(?!\n)/g, ' ');
};

export const useOcrProcessing = (options: UseOcrProcessingOptions = {}) => {
  const { onTextChange, onNewImage, onOcrComplete, onOcrError, onOptimizeComplete, llmSettings, suppressAutoProcessRef } = options;

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

  const updateOptimizedText = useCallback((value: string) => {
    setOptimizedText(value);
  }, []);

  const optimizeOcrText = useCallback(async (textToOptimize?: string) => {
    // Use provided text or fall back to current ocrText state
    const text = textToOptimize ?? ocrText;
    if (!text.trim() || !llmSettings) {
      return;
    }

    // Capture the current image path for the callback
    const currentImagePath = imagePath;
    setIsOptimizingText(true);
    setOptimizedText(''); // Clear previous optimized text
    // Don't switch to optimized view immediately - wait for completion

    try {
      let accumulatedText = '';

      await callChatCompletionStream({
        baseUrl: llmSettings.apiBaseUrl,
        model: llmSettings.modelName,
        apiKey: llmSettings.apiKey,
        temperature: llmSettings.temperature,
        maxTokens: 8000,
        reasoningEffort: 'none',
        messages: [
          {
            role: 'system',
            content: 'You are an OCR text correction expert. Your task is to clean and correct OCR-extracted text while preserving its original meaning and structure. Common OCR errors include: character misrecognition (0/O, 1/l/I, rn/m), missing spaces, extra line breaks, garbled symbols, and mixed language artifacts. Fix these issues intelligently based on context. Preserve intentional formatting like paragraphs and lists. Return ONLY the corrected text without any explanations, comments, or meta-text.'
          },
          {
            role: 'user',
            content: `Please correct the following OCR-extracted text:\n\n${text}`
          }
        ]
      }, (chunk) => {
        if (!chunk.isDone && chunk.content) {
          accumulatedText += chunk.content;
          setOptimizedText(accumulatedText);
        }
      });

      // Only switch to optimized view after successful completion
      if (accumulatedText.trim()) {
        setTextDisplayMode('optimized');

        // Notify completion with results
        onOptimizeComplete?.({
          imagePath: currentImagePath,
          optimizedText: accumulatedText
        });
      }
    } catch (error) {
      console.error('Error optimizing OCR text:', error);
      setOptimizedText(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsOptimizingText(false);
    }
  }, [ocrText, imagePath, llmSettings, onOptimizeComplete]);

  const clearOptimizedText = useCallback(() => {
    setOptimizedText('');
    setTextDisplayMode('original');
  }, []);

  const performOcrOnPath = useCallback(async (path: string) => {
    const perfStart = performance.now();
    setIsProcessing(true);
    setProcessingStatus('Loading image');

    try {
      setProcessingStatus('Preprocessing image');
      const invokeStart = performance.now();

      const result = await invoke<OcrResult>('perform_ocr', {
        imagePath: path,
        params
  });

      const invokeEnd = performance.now();
      console.log(`[Performance] Rust OCR invoke took: ${(invokeEnd - invokeStart).toFixed(0)}ms`);

      setProcessingStatus('Extracting text');
      const reflowedText = reflowOcrText(result.text);
      setOcrText(reflowedText);
      onTextChange?.(reflowedText);

      const processedUrl = convertFileSrc(result.processedImagePath);
      setProcessedImageUrl(processedUrl);
      setProcessingStatus('Complete!');

      const perfEnd = performance.now();
      console.log(`[Performance] Total OCR processing took: ${(perfEnd - perfStart).toFixed(0)}ms`);

      // Notify completion with results
      onOcrComplete?.({
        imagePath: path,
        ocrText: reflowedText,
        processedImageUrl: processedUrl
      });
    } catch (error) {
      console.error('Error performing OCR:', error);
      setProcessingStatus('Error occurred');
      const message = error instanceof Error ? error.message : String(error);
      setOcrText(`Error: ${message}`);
      onTextChange?.(`Error: ${message}`);

      // Notify error to allow cleanup of resources (e.g., imagePathToSessionIdRef)
      onOcrError?.({
        imagePath: path,
        error: message
      });
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 500);
    }
  }, [onTextChange, onOcrComplete, onOcrError, params]);

  const processImageAtPath = useCallback(async (path: string, source: 'file' | 'drop' | 'screenshot' = 'file') => {
    // Only clear state if this is a different image path to avoid unnecessary resets
    // This prevents UI flickering when processing multiple images sequentially
    if (imagePath !== path) {
      setImagePath(path);
      resetProcessedPreview();
      setOcrText('');
      clearOptimizedText();
      onTextChange?.('');
    }

    const assetUrl = convertFileSrc(path);
    setImagePreviewUrl(assetUrl);

    // Create session and get session ID
    const sessionId = onNewImage?.({ path, previewUrl: assetUrl, source });

    // Wait for OCR to complete before returning
    // State updates will propagate through the onOcrComplete callback
    await performOcrOnPath(path);

    return sessionId;
  }, [clearOptimizedText, imagePath, onNewImage, onTextChange, performOcrOnPath, resetProcessedPreview]);

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
    setProcessingStatus('Taking screenshot');

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


  // Note: Removed imagePath from dependencies to prevent duplicate processing
  // processImageAtPath already calls performOcrOnPath when image changes
  // This effect only re-processes when params change (e.g., user adjusts settings)
  const imagePathRef = useRef(imagePath);
  useEffect(() => {
    imagePathRef.current = imagePath;
  }, [imagePath]);

  // Serialize params to avoid re-triggering on object reference changes
  const paramsStr = JSON.stringify(params);

  useEffect(() => {
    if (suppressAutoProcessRef?.current) {
      return;
    }

    const currentImagePath = imagePathRef.current;
    if (!currentImagePath || isProcessingRef.current) {
      return;
    }

    // Increased debounce delay to 1000ms to prevent excessive OCR calls
    // when user is actively adjusting multiple parameters
    const timer = setTimeout(() => {
      if (!isProcessingRef.current && imagePathRef.current === currentImagePath) {
        void performOcrOnPath(currentImagePath);
      }
    }, 1000);

    return () => clearTimeout(timer);
    // Using paramsStr instead of params to avoid triggering on reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsStr, suppressAutoProcessRef]);


  const getSessionSnapshot = useCallback((): OcrSessionSnapshot => ({
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    optimizedText,
    textDisplayMode,
    params
  }), [imagePath, imagePreviewUrl, processedImageUrl, ocrText, optimizedText, textDisplayMode, params]);

  const loadSessionSnapshot = useCallback((snapshot: OcrSessionSnapshot) => {
    setImagePath(snapshot.imagePath);
    setImagePreviewUrl(snapshot.imagePreviewUrl);
    setProcessedImageUrl(snapshot.processedImageUrl);
    setOcrText(snapshot.ocrText);
    setOptimizedText(snapshot.optimizedText);
    setTextDisplayMode(snapshot.textDisplayMode);
    setParams(snapshot.params);
  }, []);

  return {
    imagePath,
    imagePreviewUrl,
    processedImageUrl,
    ocrText,
    updateOcrText,
    optimizedText,
    updateOptimizedText,
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
    processImageAtPath,
    getSessionSnapshot,
    loadSessionSnapshot
  };
};
