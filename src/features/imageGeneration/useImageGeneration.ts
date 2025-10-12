import { useCallback, useEffect, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image as TauriImage } from '@tauri-apps/api/image';
import { downloadImageAsBlob, ImageGenerationClient, ImageGenerationError } from '../../utils/imageGenClient';

interface UseImageGenerationOptions {
  bflApiKey: string;
}

export const useImageGeneration = ({ bflApiKey }: UseImageGenerationOptions) => {
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null);
  const [generatedImageRemoteUrl, setGeneratedImageRemoteUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationError, setGenerationError] = useState<string>('');

  const resetGenerationState = useCallback(() => {
    setGenerationStatus('');
    setGenerationError('');
    setGeneratedImageRemoteUrl('');
    setGeneratedImageBlob(null);
    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return '';
    });
  }, []);

  const generateImage = useCallback(async (prompt: string) => {
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
  }, [aspectRatio, bflApiKey]);

  const saveGeneratedImage = useCallback(async () => {
    if ((!generatedImageBlob && !generatedImageUrl) || isGenerating) {
      return;
    }

    try {
      setGenerationError('');
      setGenerationStatus('Saving image...');

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
      setGenerationStatus(`Image saved to: ${filePath}`);
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
  }, [generatedImageBlob, generatedImageUrl, isGenerating]);

  const copyGeneratedImageUrl = useCallback(async () => {
    if (!generatedImageRemoteUrl || isGenerating) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedImageRemoteUrl);
      setGenerationStatus('Image URL copied to clipboard');
      setGenerationError('');
    } catch (error) {
      console.error('Failed to copy image URL:', error);
      if (error instanceof Error) {
        setGenerationError(`Copy failed: ${error.message}`);
      } else {
        setGenerationError('Copy failed: Unknown error');
      }
    }
  }, [generatedImageRemoteUrl, isGenerating]);

  const copyGeneratedImageToClipboard = useCallback(async () => {
    if ((!generatedImageBlob && !generatedImageUrl) || isGenerating) {
      return;
    }

    try {
      setGenerationError('');
      setGenerationStatus('Copying image to clipboard...');

      const blob = generatedImageBlob ?? (generatedImageUrl
        ? await fetch(generatedImageUrl).then(res => res.blob())
        : null);

      if (!blob) {
        throw new Error('Unable to access generated image data.');
      }

      let copied = false;

      if (typeof window !== 'undefined' && 'ClipboardItem' in window && navigator?.clipboard?.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          copied = true;
        } catch (clipboardError) {
          console.warn('Browser clipboard write failed, falling back to Tauri clipboard plugin:', clipboardError);
        }
      }

      if (!copied) {
        const imageBitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          imageBitmap.close();
          throw new Error('Unable to access 2D canvas context for clipboard copy.');
        }

        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const rgba = new Uint8Array(imageData.data);
        const tauriImage = await TauriImage.new(rgba, canvas.width, canvas.height);
        await writeImage(tauriImage);
        copied = true;
      }

      if (!copied) {
        throw new Error('Clipboard write skipped without any available method.');
      }

      setGenerationStatus('Image copied to clipboard');
    } catch (error) {
      console.error('Failed to copy image:', error);
      setGenerationStatus('');
      if (error instanceof Error) {
        setGenerationError(`Failed to copy image: ${error.message}`);
      } else {
        setGenerationError('Failed to copy image: Unknown error');
      }
    }
  }, [generatedImageBlob, generatedImageUrl, isGenerating]);

  const clearGeneratedImage = useCallback(() => {
    if (isGenerating) {
      return;
    }

    setGeneratedImageRemoteUrl('');
    setGeneratedImageUrl(prev => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return '';
    });
    setGeneratedImageBlob(null);
    setGenerationStatus('Generated image cleared');
    setGenerationError('');
  }, [isGenerating]);

  useEffect(() => () => {
    if (generatedImageUrl) {
      URL.revokeObjectURL(generatedImageUrl);
    }
  }, [generatedImageUrl]);

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
    resetGenerationState
  };
};
