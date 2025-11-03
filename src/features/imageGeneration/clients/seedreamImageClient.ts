/**
 * Seedream 4 Image Generation Client
 * Supports advanced features:
 * - Multi-image reference (image-to-image)
 * - Sequential image generation
 * - Batch generation
 * - Streaming responses
 * - Watermark control
 * - 2K resolution
 */

import { resolveFetch } from '../../../utils/fetchUtils';
import { base64ToBlob } from '../../../utils/imageConversion';
import { ImageGenerationError } from './imageGenClient';

export interface SeedreamImageGenerationOptions {
  prompt: string;
  /** Reference images for image-to-image generation */
  referenceImages?: string[];
  /** Number of images to generate (1-4) */
  count?: number;
  /** Sequential image generation mode: 'auto' | 'enable' | 'disable' */
  sequentialMode?: 'auto' | 'enable' | 'disable';
  /** Image size: '1K' | '2K' */
  size?: '1K' | '2K';
  /** Enable/disable watermark */
  watermark?: boolean;
  /** Aspect ratio (if supported) */
  aspectRatio?: string;
}

interface SeedreamStreamChunk {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
  created: number;
  usage?: {
    total_tokens: number;
  };
}

interface SeedreamResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SeedreamGenerationResult {
  blobs: Blob[];
  objectUrls: string[];
  totalTokens: number;
}

interface SeedreamRequestBody {
  model: string;
  prompt: string;
  response_format: string;
  stream: boolean;
  watermark: boolean;
  image?: string[];
  n?: string;
  sequential_image_generation?: 'auto' | 'enable' | 'disable';
  size?: '1K' | '2K';
  aspect_ratio?: string;
}

export class SeedreamImageClient {
  private baseURL: string;
  private apiKey: string;
  private model: string = 'doubao-seedream-4-0-250828';

  constructor(apiKey: string, baseURL: string = 'https://api.bltcy.ai') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Generate images using Seedream 4
   * Returns multiple blobs and URLs if batch generation is used
   */
  async generateImage(
    options: SeedreamImageGenerationOptions,
    onProgress?: (message: string) => void
  ): Promise<SeedreamGenerationResult> {
    const {
      prompt,
      referenceImages,
      count = 1,
      sequentialMode,
      size,
      watermark = true,
      aspectRatio
    } = options;

    try {
      console.log('[SeedreamImageClient] Creating generation request:', {
        prompt,
        referenceImages,
        count,
        sequentialMode,
        size,
        watermark,
        aspectRatio
      });

      // Build request body according to OpenAPI spec
      const requestBody: SeedreamRequestBody = {
        model: this.model,
        prompt,
        response_format: 'url',
        stream: false, // We'll handle streaming separately if needed
        watermark,
        image: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
        n: count > 1 ? count.toString() : undefined,
        sequential_image_generation: sequentialMode,
        size,
        aspect_ratio: aspectRatio
      };

      // Log if adding reference images
      if (referenceImages && referenceImages.length > 0) {
        onProgress?.('Preparing image-to-image generation...');
      }

      // Log if generating multiple images
      if (count > 1) {
        onProgress?.(`Preparing to generate ${count} images...`);
      }

      console.log('[SeedreamImageClient] Request body:', JSON.stringify(requestBody, null, 2));

      onProgress?.('Generating images with Seedream 4');

      const response = await resolveFetch()(`${this.baseURL}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SeedreamImageClient] API error response:', errorText);
        throw this.handleApiError(response.status, errorText);
      }

      const data: SeedreamResponse = await response.json();
      console.log('[SeedreamImageClient] Response received:', {
        imageCount: data.data?.length || 0,
        totalTokens: data.usage?.total_tokens
      });

      if (!data.data || data.data.length === 0) {
        throw new ImageGenerationError(
          'Seedream API returned no image data',
          'REQUEST_FAILED'
        );
      }

      // Download all images
      const blobs: Blob[] = [];
      const objectUrls: string[] = [];

      for (let i = 0; i < data.data.length; i++) {
        const imageData = data.data[i];
        onProgress?.(`Downloading image ${i + 1}/${data.data.length}`);

        let blob: Blob;
        let objectUrl: string;

        if (imageData.url) {
          // URL format - download the image
          console.log(`[SeedreamImageClient] Downloading image ${i + 1} from URL:`, imageData.url);
          const imageResponse = await resolveFetch()(imageData.url);
          if (!imageResponse.ok) {
            throw new ImageGenerationError(
              `Failed to download image ${i + 1}: HTTP ${imageResponse.status}`,
              'DOWNLOAD_FAILED'
            );
          }
          blob = await imageResponse.blob();
          objectUrl = URL.createObjectURL(blob);
        } else if (imageData.b64_json) {
          // Base64 format
          console.log(`[SeedreamImageClient] Converting image ${i + 1} from base64`);
          const result = base64ToBlob(imageData.b64_json);
          blob = result.blob;
          objectUrl = result.objectUrl;
        } else {
          throw new ImageGenerationError(
            `Image ${i + 1} missing both url and b64_json`,
            'REQUEST_FAILED'
          );
        }

        blobs.push(blob);
        objectUrls.push(objectUrl);

        console.log(`[SeedreamImageClient] Image ${i + 1} processed:`, {
          blobSize: blob.size,
          blobType: blob.type,
          objectUrl
        });
      }

      return {
        blobs,
        objectUrls,
        totalTokens: data.usage?.total_tokens || 0
      };
    } catch (error) {
      console.error('[SeedreamImageClient] Generation error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate images with streaming support
   * Calls onProgress callback with real-time updates
   */
  async generateImageStreaming(
    options: SeedreamImageGenerationOptions,
    onProgress: (message: string) => void
  ): Promise<SeedreamGenerationResult> {
    const {
      prompt,
      referenceImages,
      count = 1,
      sequentialMode,
      size,
      watermark = true
    } = options;

    try {
      console.log('[SeedreamImageClient] Creating streaming generation request');

      const requestBody: SeedreamRequestBody = {
        model: this.model,
        prompt,
        response_format: 'url',
        stream: true,
        watermark,
        image: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
        n: count > 1 ? count.toString() : undefined,
        sequential_image_generation: sequentialMode,
        size
      };

      if (referenceImages && referenceImages.length > 0) {
        onProgress('Preparing image-to-image generation...');
      }

      if (count > 1) {
        onProgress(`Preparing to generate ${count} images...`);
      }

      onProgress('Starting streaming generation...');

      const response = await resolveFetch()(`${this.baseURL}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw this.handleApiError(response.status, errorText);
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new ImageGenerationError('Failed to read stream', 'REQUEST_FAILED');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: SeedreamResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onProgress('Stream completed');
              break;
            }

            try {
              const chunk: SeedreamStreamChunk = JSON.parse(data);
              if (chunk.usage) {
                onProgress(`Progress: ${chunk.usage.total_tokens} tokens used`);
              }
              // Store the last chunk as final data
              finalData = chunk as any;
            } catch (e) {
              console.warn('[SeedreamImageClient] Failed to parse stream chunk:', e);
            }
          }
        }
      }

      if (!finalData || !finalData.data || finalData.data.length === 0) {
        throw new ImageGenerationError(
          'Streaming completed but no image data received',
          'REQUEST_FAILED'
        );
      }

      // Download all images
      const blobs: Blob[] = [];
      const objectUrls: string[] = [];

      for (let i = 0; i < finalData.data.length; i++) {
        const imageData = finalData.data[i];
        onProgress(`Downloading image ${i + 1}/${finalData.data.length}`);

        if (imageData.url) {
          const imageResponse = await resolveFetch()(imageData.url);
          if (!imageResponse.ok) {
            throw new ImageGenerationError(
              `Failed to download image ${i + 1}`,
              'DOWNLOAD_FAILED'
            );
          }
          const blob = await imageResponse.blob();
          const objectUrl = URL.createObjectURL(blob);
          blobs.push(blob);
          objectUrls.push(objectUrl);
        } else if (imageData.b64_json) {
          const result = base64ToBlob(imageData.b64_json);
          blobs.push(result.blob);
          objectUrls.push(result.objectUrl);
        }
      }

      return {
        blobs,
        objectUrls,
        totalTokens: finalData.usage?.total_tokens || 0
      };
    } catch (error) {
      console.error('[SeedreamImageClient] Streaming generation error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle API error responses
   */
  private handleApiError(status: number, errorText: string): ImageGenerationError {
    let errorCode: ImageGenerationError['code'] = 'REQUEST_FAILED';
    let errorMessage = `HTTP ${status}: ${errorText || 'Unknown error'}`;

    if (status === 401) {
      errorCode = 'REQUEST_FAILED';
      errorMessage = 'Invalid API key. Please check your BLTCY configuration.';
    } else if (status === 402) {
      errorCode = 'INSUFFICIENT_CREDITS';
      errorMessage = 'Insufficient credits. Please check your account balance.';
    } else if (status === 429) {
      errorCode = 'RATE_LIMIT';
      errorMessage = 'Rate limit exceeded. Please try again later.';
    }

    return new ImageGenerationError(errorMessage, errorCode);
  }

  /**
   * Handle general errors
   */
  private handleError(error: unknown): ImageGenerationError {
    if (error instanceof ImageGenerationError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return new ImageGenerationError(
          'Network error: Cannot connect to API. Please check your internet connection.',
          'REQUEST_FAILED'
        );
      }

      return new ImageGenerationError(
        `Seedream API error: ${error.message}`,
        'REQUEST_FAILED'
      );
    }

    return new ImageGenerationError(
      'Unknown error occurred during image generation',
      'UNKNOWN'
    );
  }
}

