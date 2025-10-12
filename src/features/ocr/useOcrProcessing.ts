import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { ProcessingParams, OcrResult } from './types';

interface UseOcrProcessingOptions {
  onTextChange?: (text: string) => void;
  onNewImage?: () => void;
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

export const useOcrProcessing = (options: UseOcrProcessingOptions = {}) => {
  const { onTextChange, onNewImage } = options;

  const [imagePath, setImagePath] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
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
      setOcrText(result.text);
      onTextChange?.(result.text);

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

  const selectImage = useCallback(async () => {
    try {
      const selected = await open({
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
      onTextChange?.('');
      onNewImage?.();

      const assetUrl = convertFileSrc(path);
      setImagePreviewUrl(assetUrl);

      await performOcrOnPath(path);
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  }, [performOcrOnPath, onNewImage, onTextChange, resetProcessedPreview]);

  const takeScreenshot = useCallback(async () => {
    setIsProcessing(true);
    setProcessingStatus('Taking screenshot...');

    try {
      const result = await invoke<{ path: string; text: string }>('take_screenshot');
      setImagePath(result.path);
      resetProcessedPreview();
      setOcrText('');
      onTextChange?.('');
      onNewImage?.();

      const assetUrl = convertFileSrc(result.path);
      setImagePreviewUrl(assetUrl);
      setProcessingStatus('Processing image...');

      await performOcrOnPath(result.path);
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Error: ' + error);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  }, [onNewImage, onTextChange, performOcrOnPath, resetProcessedPreview]);

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
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (!imageFile) {
      return;
    }

    try {
      const path = (imageFile as any).path || imageFile.name;
      setImagePath(path);
      resetProcessedPreview();
      setOcrText('');
      onTextChange?.('');
      onNewImage?.();

      const assetUrl = convertFileSrc(path);
      setImagePreviewUrl(assetUrl);

      await performOcrOnPath(path);
    } catch (error) {
      console.error('Error handling dropped file:', error);
    }
  }, [onNewImage, onTextChange, performOcrOnPath, resetProcessedPreview]);

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
