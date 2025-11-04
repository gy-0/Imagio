import { useCallback, useEffect, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir, exists, readFile, remove } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { join, appLocalDataDir } from '@tauri-apps/api/path';
import { downloadImageAsBlob, ImageGenerationClient, ImageGenerationError } from './clients/imageGenClient';
import { GeminiImageClient } from './clients/geminiImageClient';
import { BltcyImageClient, type BltcyModel } from './clients/bltcyImageClient';
import { SeedreamImageClient } from './clients/seedreamImageClient';
import { detectImageFormat, formatToMimeType, generateImageFilename } from './utils/imageFormat';
import { getModelProvider, getModelDisplayName, getApiModelName } from '../promptOptimization/modelConfig';
import type { ImageGenModel } from '../promptOptimization/types';

interface UseImageGenerationOptions {
  bflApiKey: string;
  geminiApiKey: string;
  bltcyApiKey: string;
  selectedModel: ImageGenModel;
}

export interface ImageGenerationSessionSnapshot {
  aspectRatio: string;
  generatedImageUrl: string;
  generatedImageRemoteUrl: string;
  generatedImageLocalPath: string;
}

const LOCAL_IMAGE_DIR_NAME = 'generated-images';

export const useImageGeneration = ({ bflApiKey, geminiApiKey, bltcyApiKey, selectedModel }: UseImageGenerationOptions) => {
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null);
  const [generatedImageRemoteUrl, setGeneratedImageRemoteUrl] = useState<string>('');
  const [generatedImageLocalPath, setGeneratedImageLocalPath] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationError, setGenerationError] = useState<string>('');

  // Track all created blob URLs for cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set());
  // Track timeout for auto-clearing status messages
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ensureLocalImageDirectory = useCallback(async (): Promise<string> => {
    const appDir = await appLocalDataDir();
    const imagesDir = await join(appDir, LOCAL_IMAGE_DIR_NAME);

    try {
      const directoryExists = await exists(imagesDir);
      if (!directoryExists) {
        await mkdir(imagesDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to ensure local generated image directory:', error);
      throw error;
    }

    return imagesDir;
  }, []);

  const deleteLocalImageFile = useCallback(async (filePath: string) => {
    if (!filePath) {
      return;
    }

    try {
      const fileExists = await exists(filePath);
      if (fileExists) {
        await remove(filePath);
      }
    } catch (error) {
      console.warn('Failed to delete local generated image file:', filePath, error);
    }
  }, []);

  const persistGeneratedImageBlob = useCallback(async (blob: Blob): Promise<string> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const format = detectImageFormat(bytes, blob.type);
      const directory = await ensureLocalImageDirectory();
      const fileName = generateImageFilename(format, 'imagio-generated');
      const filePath = await join(directory, fileName);

      await writeFile(filePath, bytes);
      return filePath;
    } catch (error) {
      console.error('Failed to persist generated image locally:', error);
      return '';
    }
  }, [ensureLocalImageDirectory]);

  const loadLocalImageAsBlob = useCallback(async (filePath: string): Promise<{ blob: Blob; objectUrl: string }> => {
    const bytes = await readFile(filePath);
    const format = detectImageFormat(bytes);
    const mimeType = formatToMimeType(format);
    const blob = new Blob([bytes], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    return { blob, objectUrl };
  }, []);

  // Helper function to set status with auto-clear for success messages
  const setStatusWithAutoClear = useCallback((message: string) => {
    // Clear any existing timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    setGenerationStatus(message);

    // Auto-clear success messages after 3 seconds
    const isSuccessMessage = message.includes('saved to:') ||
                            message.includes('copied to clipboard') ||
                            message.includes('Auto-saved!') ||
                            message.includes('cleared');

    if (isSuccessMessage) {
      statusTimeoutRef.current = setTimeout(() => {
        setGenerationStatus('');
        statusTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

  const resetGenerationState = useCallback(() => {
    // Clear any pending timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    setGenerationStatus('');
    setGenerationError('');
    setGeneratedImageRemoteUrl('');
    setGeneratedImageBlob(null);
    void deleteLocalImageFile(generatedImageLocalPath);
    setGeneratedImageLocalPath('');
    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
        blobUrlsRef.current.delete(prev);
      }
      return '';
    });
  }, [deleteLocalImageFile, generatedImageLocalPath]);

  const generateImage = useCallback(async (prompt: string) => {
    // Prevent duplicate generation if already generating
    if (isGenerating) {
      console.log('Generation already in progress, skipping duplicate request');
      return;
    }

    setGenerationStatus('');
    setGenerationError('');

    if (!prompt.trim()) {
      setGenerationError('Please optimize the prompt first.');
      return;
    }

    // Validate API key based on selected model provider
    const provider = getModelProvider(selectedModel);

    if (provider === 'bfl' && !bflApiKey.trim()) {
      setGenerationError('Please configure FLUX API Key (BFL) in settings.');
      return;
    }

    if (provider === 'gemini' && !geminiApiKey.trim()) {
      setGenerationError('Please configure Gemini API Key in settings.');
      return;
    }

    if (provider === 'bltcy' && !bltcyApiKey.trim()) {
      setGenerationError('Please configure BLTCY API Key in settings.');
      return;
    }

    setGenerationStatus('Generating image');
    setGenerationError('');
    setIsGenerating(true);
    setGeneratedImageRemoteUrl('');
    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
        blobUrlsRef.current.delete(prev);
      }
      return '';
    });
    setGeneratedImageBlob(null);

    try {
      const previousLocalPath = generatedImageLocalPath;
      let blob: Blob;
      let objectUrl: string;

      const provider = getModelProvider(selectedModel);
      const modelDisplayName = getModelDisplayName(selectedModel);

      if (provider === 'bfl') {
        // FLUX generation flow (BFL official)
        const client = new ImageGenerationClient(bflApiKey);

        setGenerationStatus('Creating generation request');
        const imageUrl = await client.generateImage({
          prompt,
          aspectRatio: aspectRatio || undefined
        });

        setGeneratedImageRemoteUrl(imageUrl);
        setGenerationStatus('Downloading image');
        const result = await downloadImageAsBlob(imageUrl);
        blob = result.blob;
        objectUrl = result.objectUrl;
      } else if (provider === 'gemini') {
        // Gemini generation flow (official Nano Banana)
        const client = new GeminiImageClient(geminiApiKey);

        setGenerationStatus(`Generating with ${modelDisplayName}`);
        const result = await client.generateImage({
          prompt,
          aspectRatio: aspectRatio || undefined
        });
        blob = result.blob;
        objectUrl = result.objectUrl;
        // Gemini doesn't provide a remote URL, image is generated inline
      } else if (selectedModel === 'doubao-seedream-4-0') {
        // Seedream 4 - Use specialized client with advanced features
        const client = new SeedreamImageClient(bltcyApiKey);

        setGenerationStatus(`Generating with ${modelDisplayName}`);
        const result = await client.generateImage(
          {
            prompt,
            aspectRatio: aspectRatio || undefined,
            count: 1, // Single image by default
            watermark: true,
            size: '2K' // Use 2K resolution by default for best quality
          },
          (message) => {
            setGenerationStatus(message);
          }
        );

        // Use the first image (in case batch generation is added later)
        blob = result.blobs[0];
        objectUrl = result.objectUrls[0];
        console.log('[useImageGeneration] Seedream 4 generation completed, tokens:', result.totalTokens);
      } else {
        // BLTCY generation flow (proxy provider)
        const client = new BltcyImageClient(bltcyApiKey);
        const apiModel = getApiModelName(selectedModel);

        setGenerationStatus(`Generating with ${modelDisplayName}`);
        const result = await client.generateImage({
          prompt,
          model: apiModel as BltcyModel,
          aspectRatio: aspectRatio || undefined
        });
        blob = result.blob;
        objectUrl = result.objectUrl;
        // BLTCY doesn't provide a remote URL, image is generated inline
      }

      const persistedPath = await persistGeneratedImageBlob(blob);
      if (persistedPath) {
        setGeneratedImageLocalPath(persistedPath);
        if (previousLocalPath && previousLocalPath !== persistedPath) {
          void deleteLocalImageFile(previousLocalPath);
        }
      } else {
        console.warn('Generated image could not be persisted locally; session history may not restore this image later.');
        setGeneratedImageLocalPath('');
      }

      setGeneratedImageBlob(blob);
      // Track blob URL immediately before setting state to prevent timing issues
      blobUrlsRef.current.add(objectUrl);
      setGeneratedImageUrl(objectUrl);
      console.log('[useImageGeneration] Image generated successfully, objectUrl:', objectUrl);
      setGenerationStatus('');
    } catch (error) {
      console.error('Error generating image:', error);
      setGenerationStatus('');

      if (error instanceof ImageGenerationError) {
        setGenerationError(error.message);
      } else if (error instanceof Error) {
        setGenerationError(`Unexpected error: ${error.message}`);
      } else {
        setGenerationError('An unknown error occurred. Please check the console.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    aspectRatio,
    bflApiKey,
    geminiApiKey,
    bltcyApiKey,
    selectedModel,
    generatedImageLocalPath,
    isGenerating,
    persistGeneratedImageBlob,
    deleteLocalImageFile
  ]);

  const saveGeneratedImage = useCallback(async () => {
    console.log('[saveGeneratedImage] Called', {
      hasBlob: !!generatedImageBlob,
      hasUrl: !!generatedImageUrl,
      isGenerating
    });

    if ((!generatedImageBlob && !generatedImageUrl) || isGenerating) {
      console.log('[saveGeneratedImage] Exiting early - no image data or still generating');
      return;
    }

    try {
      setGenerationError('');
      setGenerationStatus('Saving image');
      console.log('[saveGeneratedImage] Starting save process');

      const blobCandidate = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blobCandidate) {
        throw new Error('Unable to access generated image data.');
      }

      const arrayBuffer = await blobCandidate.arrayBuffer();

      // Detect actual image format from blob type and magic bytes
      const bytes = new Uint8Array(arrayBuffer);
      const extension = detectImageFormat(bytes, blobCandidate.type);

      console.log('[saveGeneratedImage] Detected image format:', {
        mimeType: blobCandidate.type,
        extension,
        firstBytes: Array.from(bytes.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });

      const defaultFileName = generateImageFilename(extension);
      const filePath = await save({
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }],
        defaultPath: defaultFileName
      });

      if (!filePath) {
        setGenerationStatus('');
        return;
      }

      await writeFile(filePath, new Uint8Array(arrayBuffer));
      setStatusWithAutoClear(`Image saved to: ${filePath}`);
    } catch (error) {
      console.error('Error saving generated image:', error);
      setGenerationStatus('');
      const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      setGenerationError(`Save failed: ${message || 'Unknown error'}`);
    }
  }, [generatedImageBlob, generatedImageUrl, isGenerating, setStatusWithAutoClear]);

  const copyGeneratedImageUrl = useCallback(async () => {
    console.log('[copyGeneratedImageUrl] Called', {
      hasRemoteUrl: !!generatedImageRemoteUrl,
      remoteUrl: generatedImageRemoteUrl,
      isGenerating
    });

    if (!generatedImageRemoteUrl || isGenerating) {
      console.log('[copyGeneratedImageUrl] Exiting early - no remote URL or still generating');
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedImageRemoteUrl);
      setStatusWithAutoClear('Image URL copied to clipboard');
      setGenerationError('');
      console.log('[copyGeneratedImageUrl] URL copied successfully');
    } catch (error) {
      console.error('Failed to copy image URL:', error);
      if (error instanceof Error) {
        setGenerationError(`Copy failed: ${error.message}`);
      } else {
        setGenerationError('Copy failed: Unknown error');
      }
    }
  }, [generatedImageRemoteUrl, isGenerating, setStatusWithAutoClear]);

  const copyGeneratedImageToClipboard = useCallback(async () => {
    if ((!generatedImageBlob && !generatedImageUrl) || isGenerating) {
      setGenerationError('No image available to copy');
      return;
    }

    try {
      setGenerationError('');
      setGenerationStatus('Copying image');

      // Get blob
      const blob = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blob) {
        throw new Error('Unable to access image data');
      }

      // Convert to byte array and pass to Rust
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      await invoke('copy_image_from_bytes', { imageBytes: bytes });

      setStatusWithAutoClear('Image copied to clipboard');
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      setGenerationStatus('');
      if (error instanceof Error) {
        setGenerationError(`Failed to copy image: ${error.message}`);
      } else {
        setGenerationError('Failed to copy image: Unknown error');
      }
    }
  }, [generatedImageBlob, generatedImageUrl, isGenerating, setStatusWithAutoClear]);

  const saveGeneratedImageToDirectory = useCallback(async (directoryPath: string) => {
    if ((!generatedImageBlob && !generatedImageUrl) || isGenerating) {
      return;
    }

    try {
      setGenerationError('');
      setGenerationStatus('Auto-saving image');

      const blobCandidate = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blobCandidate) {
        throw new Error('Unable to access generated image data.');
      }

      const arrayBuffer = await blobCandidate.arrayBuffer();

      // Detect actual image format from blob type and magic bytes
      const bytes = new Uint8Array(arrayBuffer);
      const extension = detectImageFormat(bytes, blobCandidate.type);
      const fileName = generateImageFilename(extension);

      const directoryExists = await exists(directoryPath);
      if (!directoryExists) {
        await mkdir(directoryPath, { recursive: true });
      }

      const filePath = await join(directoryPath, fileName);
      await writeFile(filePath, new Uint8Array(arrayBuffer));

      setStatusWithAutoClear(`Auto-saved!`);
      return filePath;
    } catch (error) {
      console.error('Error auto-saving generated image:', error);
      setGenerationStatus('');
      if (error instanceof Error) {
        setGenerationError(`Auto-save failed: ${error.message}`);
      } else {
        setGenerationError('Auto-save failed: Unknown error');
      }
      throw error;
    }
  }, [generatedImageBlob, generatedImageUrl, isGenerating, setStatusWithAutoClear]);

  const clearGeneratedImage = useCallback(() => {
    if (isGenerating) {
      return;
    }

    console.log('[useImageGeneration] Clearing generated image');
    setGeneratedImageRemoteUrl('');
    void deleteLocalImageFile(generatedImageLocalPath);
    setGeneratedImageLocalPath('');
    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
        blobUrlsRef.current.delete(prev);
      }
      return '';
    });
    setGeneratedImageBlob(null);
    setStatusWithAutoClear('Generated image cleared');
    setGenerationError('');
  }, [deleteLocalImageFile, generatedImageLocalPath, isGenerating, setStatusWithAutoClear]);

  // Store blob URLs when created (belt-and-suspenders with immediate tracking above)
  useEffect(() => {
    if (generatedImageUrl && generatedImageUrl.startsWith('blob:')) {
      // Double-check it's tracked (should already be tracked from immediate add above)
      if (!blobUrlsRef.current.has(generatedImageUrl)) {
        console.log('[useImageGeneration] Late-tracking blob URL:', generatedImageUrl);
        blobUrlsRef.current.add(generatedImageUrl);
      }
    }
  }, [generatedImageUrl]);

  // Cleanup all blob URLs and timeouts when component unmounts
  useEffect(() => {
    return () => {
      console.log('[useImageGeneration] Component unmounting, revoking all blob URLs');
      blobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      blobUrlsRef.current.clear();

      // Clear any pending timeout
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, []);

  const getSessionSnapshot = useCallback((): ImageGenerationSessionSnapshot => ({
    aspectRatio,
    generatedImageUrl: '',
    generatedImageRemoteUrl,
    generatedImageLocalPath
  }), [aspectRatio, generatedImageLocalPath, generatedImageRemoteUrl]);

  const loadSessionSnapshot = useCallback(async (snapshot: ImageGenerationSessionSnapshot) => {
    setAspectRatio(snapshot.aspectRatio);
    setGenerationStatus('');
    setGenerationError('');
    setGeneratedImageRemoteUrl(snapshot.generatedImageRemoteUrl);
    setGeneratedImageBlob(null);
    setGeneratedImageLocalPath('');

    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
        blobUrlsRef.current.delete(prev);
      }
      return '';
    });

    let restored = false;

    if (snapshot.generatedImageLocalPath) {
      try {
        const { blob, objectUrl } = await loadLocalImageAsBlob(snapshot.generatedImageLocalPath);
        setGeneratedImageBlob(blob);
        blobUrlsRef.current.add(objectUrl);
        setGeneratedImageUrl(prev => {
          if (prev && prev !== objectUrl) {
            URL.revokeObjectURL(prev);
            blobUrlsRef.current.delete(prev);
          }
          return objectUrl;
        });
        setGeneratedImageLocalPath(snapshot.generatedImageLocalPath);
        restored = true;
      } catch (error) {
        console.error('Error restoring generated image from local file:', error);
      }
    }

    if (!restored && snapshot.generatedImageUrl) {
      setGeneratedImageUrl(prev => {
        if (prev && prev !== snapshot.generatedImageUrl) {
          URL.revokeObjectURL(prev);
          blobUrlsRef.current.delete(prev);
        }
        return snapshot.generatedImageUrl;
      });
      restored = true;
    }

    if (!restored && snapshot.generatedImageRemoteUrl) {
      try {
        const { blob, objectUrl } = await downloadImageAsBlob(snapshot.generatedImageRemoteUrl);
        setGeneratedImageBlob(blob);
        // Track blob URL immediately before setting state
        blobUrlsRef.current.add(objectUrl);
        setGeneratedImageUrl((prev) => {
          if (prev && prev !== objectUrl) {
            URL.revokeObjectURL(prev);
            blobUrlsRef.current.delete(prev);
          }
          return objectUrl;
        });
        const persistedPath = await persistGeneratedImageBlob(blob);
        if (persistedPath) {
          setGeneratedImageLocalPath(persistedPath);
        }
        restored = true;
      } catch (error) {
        console.error('Error restoring generated image from remote URL:', error);
      }
    }
  }, [loadLocalImageAsBlob, persistGeneratedImageBlob]);

  return {
    aspectRatio,
    setAspectRatio,
    generatedImageUrl,
    generatedImageRemoteUrl,
    generatedImageLocalPath,
    isGenerating,
    generationStatus,
    generationError,
    generateImage,
    saveGeneratedImage,
    copyGeneratedImageUrl,
    copyGeneratedImageToClipboard,
    clearGeneratedImage,
    resetGenerationState,
    saveGeneratedImageToDirectory,
    getSessionSnapshot,
    loadSessionSnapshot
  };
};
