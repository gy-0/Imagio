import { useCallback, useEffect, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image as TauriImage } from '@tauri-apps/api/image';
import { join } from '@tauri-apps/api/path';
import { downloadImageAsBlob, ImageGenerationClient, ImageGenerationError } from '../../utils/imageGenClient';

interface UseImageGenerationOptions {
  bflApiKey: string;
}

export interface ImageGenerationSessionSnapshot {
  aspectRatio: string;
  generatedImageUrl: string;
  generatedImageRemoteUrl: string;
}

export const useImageGeneration = ({ bflApiKey }: UseImageGenerationOptions) => {
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null);
  const [generatedImageRemoteUrl, setGeneratedImageRemoteUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationError, setGenerationError] = useState<string>('');

  // Track all created blob URLs for cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set());
  // Track timeout for auto-clearing status messages
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
        blobUrlsRef.current.delete(prev);
      }
      return '';
    });
  }, []);

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

    if (!bflApiKey.trim()) {
      setGenerationError('Please configure BFL API Key (set bflApiKey in config.local.json).');
      return;
    }

    setGenerationStatus('Generating image...');
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
      const client = new ImageGenerationClient(bflApiKey);

      setGenerationStatus('Creating generation request...');
      const imageUrl = await client.generateImage({
        prompt,
        aspectRatio: aspectRatio || undefined
      });

      setGeneratedImageRemoteUrl(imageUrl);
      setGenerationStatus('Downloading image...');
      const { blob, objectUrl } = await downloadImageAsBlob(imageUrl);

      setGeneratedImageBlob(blob);
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
  }, [aspectRatio, bflApiKey, isGenerating]);

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
      setGenerationStatus('Saving image...');
      console.log('[saveGeneratedImage] Starting save process');

      const blobCandidate = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blobCandidate) {
        throw new Error('Unable to access generated image data.');
      }

      const arrayBuffer = await blobCandidate.arrayBuffer();

      const defaultFileName = `imagio-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      const filePath = await save({
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg']
        }],
        defaultPath: defaultFileName
      });

      if (!filePath) {
        setGenerationStatus('Save cancelled');
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
    console.log('[copyGeneratedImageToClipboard] Called', {
      hasBlob: !!generatedImageBlob,
      hasUrl: !!generatedImageUrl,
      isGenerating
    });

    if ((!generatedImageBlob && !generatedImageUrl) || isGenerating) {
      console.log('[copyGeneratedImageToClipboard] Exiting early - no image data or still generating');
      setGenerationError('No image data available to copy');
      return;
    }

    try {
      setGenerationError('');
      setGenerationStatus('Copying image to clipboard...');
      console.log('[copyGeneratedImageToClipboard] Starting copy process');

      const blob = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blob) {
        throw new Error('Unable to access generated image data');
      }

      // Only use Tauri clipboard method
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        imageBitmap.close();
        throw new Error('Unable to get canvas context, cannot copy image');
      }

      ctx.drawImage(imageBitmap, 0, 0);
      imageBitmap.close();

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgba = new Uint8Array(imageData.data);
      const tauriImage = await TauriImage.new(rgba, canvas.width, canvas.height);
      await writeImage(tauriImage);

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
      setGenerationStatus('Auto-saving image...');

      const blobCandidate = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blobCandidate) {
        throw new Error('Unable to access generated image data.');
      }

      const arrayBuffer = await blobCandidate.arrayBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `imagio-${timestamp}.png`;

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
  }, [isGenerating, setStatusWithAutoClear]);

  // Store blob URLs when created
  useEffect(() => {
    if (generatedImageUrl && generatedImageUrl.startsWith('blob:')) {
      blobUrlsRef.current.add(generatedImageUrl);
      console.log('[useImageGeneration] Tracking new blob URL:', generatedImageUrl);
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
    generatedImageUrl,
    generatedImageRemoteUrl
  }), [aspectRatio, generatedImageRemoteUrl, generatedImageUrl]);

  const loadSessionSnapshot = useCallback(async (snapshot: ImageGenerationSessionSnapshot) => {
    setAspectRatio(snapshot.aspectRatio);
    setGenerationStatus('');
    setGenerationError('');
    setGeneratedImageRemoteUrl(snapshot.generatedImageRemoteUrl);
    setGeneratedImageBlob(null);

    setGeneratedImageUrl((prev) => {
      if (prev && prev !== snapshot.generatedImageUrl) {
        URL.revokeObjectURL(prev);
        blobUrlsRef.current.delete(prev);
      }
      return snapshot.generatedImageUrl;
    });

    if (!snapshot.generatedImageUrl && snapshot.generatedImageRemoteUrl) {
      try {
        const { blob, objectUrl } = await downloadImageAsBlob(snapshot.generatedImageRemoteUrl);
        setGeneratedImageBlob(blob);
        setGeneratedImageUrl((prev) => {
          if (prev && prev !== objectUrl) {
            URL.revokeObjectURL(prev);
            blobUrlsRef.current.delete(prev);
          }
          return objectUrl;
        });
      } catch (error) {
        console.error('Error restoring generated image from remote URL:', error);
      }
    }
  }, []);

  return {
    aspectRatio,
    setAspectRatio,
    generatedImageUrl,
    generatedImageRemoteUrl,
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
