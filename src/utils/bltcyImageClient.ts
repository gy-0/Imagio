/**
 * BLTCY Image Generation Client
 * Supports two API formats:
 * 1. OpenAI Chat Completions format (/v1/chat/completions) - for most models
 * 2. OpenAI DALL-E format (/v1/images/generations) - for nano-banana models
 * Base URL: https://api.bltcy.ai
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { ImageGenerationError } from './imageGenClient';

export type BltcyModel =
  | 'gpt-image-1'
  | 'gpt-4o-image'
  | 'sora_image'
  | 'flux-kontext-pro'
  | 'flux'
  | 'nano-banana'
  | 'dall-e-3'
  | 'recraftv3'
  | 'qwen-image'
  | 'nano-banana-hd'
  | 'doubao-seedream-4-0-250828'
  | 'doubao-seededit-3-0-i2i-250628'
  | 'doubao-seedream-3-0-t2i-250415';

export interface BltcyImageGenerationOptions {
  prompt: string;
  model?: BltcyModel;
  aspectRatio?: string;
}

// DALL-E format response
interface DalleImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

interface ChatCompletionMessage {
  role: string;
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: ChatCompletionMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class BltcyImageClient {
  private baseURL: string;
  private apiKey: string;

  constructor(apiKey: string, baseURL: string = 'https://api.bltcy.ai') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Determine which API format to use based on model
   */
  private getApiFormat(model: string): 'bfl-proxy' | 'dalle' | 'chat' {
    // BFL proxy format for FLUX Pro/Dev models only
    // BLTCY's BFL proxy supports: flux-kontext-pro, flux-kontext-max,
    // flux-pro-1.1-ultra, flux-pro-1.1, flux-pro, flux-dev
    // Note: 'flux' (without suffix) is NOT supported by BFL proxy
    if (model === 'flux-kontext-pro' || model === 'flux-kontext-max' ||
        model === 'flux-pro-1.1-ultra' || model === 'flux-pro-1.1' ||
        model === 'flux-pro' || model === 'flux-dev') {
      return 'bfl-proxy';
    }
    // DALL-E format for nano-banana models
    if (model === 'nano-banana' || model === 'nano-banana-hd') {
      return 'dalle';
    }
    // Chat Completions format for everything else (including 'flux')
    return 'chat';
  }

  /**
   * Generate an image from a prompt
   * Automatically chooses the correct API format based on model
   * Returns a blob and object URL for the generated image
   */
  async generateImage(options: BltcyImageGenerationOptions): Promise<{ blob: Blob; objectUrl: string }> {
    const { prompt, model = 'flux-pro-1.1-ultra', aspectRatio } = options;

    const format = this.getApiFormat(model);

    if (format === 'bfl-proxy') {
      return this.generateImageBflProxy(prompt, model, aspectRatio);
    } else if (format === 'dalle') {
      return this.generateImageDalleFormat(prompt, model, aspectRatio);
    } else {
      return this.generateImageChatFormat(prompt, model);
    }
  }

  /**
   * Convert aspect ratio string to width/height dimensions
   * BFL API requires explicit width/height instead of aspect_ratio
   */
  private aspectRatioToWidthHeight(aspectRatio: string): { width: number; height: number } {
    const ratioMap: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '21:9': { width: 1536, height: 640 },
      '9:21': { width: 640, height: 1536 },
      '4:3': { width: 1152, height: 896 },
      '3:4': { width: 896, height: 1152 },
      '3:2': { width: 1216, height: 832 },
      '2:3': { width: 832, height: 1216 }
    };

    return ratioMap[aspectRatio] || { width: 1024, height: 1024 };
  }

  /**
   * Generate image using BFL proxy API (compatible with BFL official API)
   * Used for FLUX models with width/height support
   */
  private async generateImageBflProxy(
    prompt: string,
    model: string,
    aspectRatio?: string
  ): Promise<{ blob: Blob; objectUrl: string }> {
    try {
      console.log('[BltcyImageClient] Creating BFL proxy request:', { prompt, model, aspectRatio });

      // Convert aspect ratio to width/height
      const dimensions = aspectRatio
        ? this.aspectRatioToWidthHeight(aspectRatio)
        : { width: 1024, height: 1024 };

      // Step 1: Create generation request
      const requestBody: any = {
        prompt,
        width: dimensions.width,
        height: dimensions.height,
        steps: 28,
        prompt_upsampling: false,
        seed: Math.floor(Math.random() * 1000000),
        guidance: 3.5,
        safety_tolerance: 2,
        output_format: 'jpeg'
      };

      console.log('[BltcyImageClient] BFL request body:', JSON.stringify(requestBody, null, 2));

      const createResponse = await resolveFetch()(`${this.baseURL}/bfl/v1/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[BltcyImageClient] BFL API error response:', errorText);
        throw this.handleApiError(createResponse.status, errorText);
      }

      const createData = await createResponse.json();
      console.log('[BltcyImageClient] BFL request created:', {
        id: createData.id,
        status: createData.status
      });

      if (!createData.id) {
        throw new ImageGenerationError(
          'BFL API response missing request ID',
          'REQUEST_FAILED'
        );
      }

      // Step 2: Poll for result
      const imageUrl = await this.pollBflResult(createData.id);

      // Step 3: Download the image
      console.log('[BltcyImageClient] Downloading BFL image from:', imageUrl);
      const imageResponse = await resolveFetch()(imageUrl);
      if (!imageResponse.ok) {
        throw new ImageGenerationError(
          `Failed to download image: HTTP ${imageResponse.status}`,
          'DOWNLOAD_FAILED'
        );
      }

      const blob = await imageResponse.blob();
      const objectUrl = URL.createObjectURL(blob);

      console.log('[BltcyImageClient] BFL image generated successfully:', {
        blobSize: blob.size,
        blobType: blob.type,
        objectUrl
      });

      return { blob, objectUrl };
    } catch (error) {
      console.error('[BltcyImageClient] BFL generation error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Poll BFL proxy API for generation result
   */
  private async pollBflResult(requestId: string, maxAttempts: number = 120): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await resolveFetch()(`${this.baseURL}/bfl/v1/get_result?id=${requestId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          throw new ImageGenerationError(
            `Failed to get BFL result: HTTP ${response.status}`,
            'REQUEST_FAILED'
          );
        }

        const data = await response.json();
        console.log('[BltcyImageClient] BFL poll attempt', attempt + 1, ':', data.status);

        if (data.status === 'Ready' && data.result?.sample) {
          return data.result.sample;
        } else if (data.status === 'Error') {
          throw new ImageGenerationError(
            `BFL generation failed: ${data.error || 'Unknown error'}`,
            'REQUEST_FAILED'
          );
        }

        // Still pending, wait before next poll
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        if (error instanceof ImageGenerationError) {
          throw error;
        }
        throw new ImageGenerationError(
          `Failed to poll BFL result: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'REQUEST_FAILED'
        );
      }
    }

    throw new ImageGenerationError(
      'BFL generation timed out after maximum polling attempts',
      'REQUEST_FAILED'
    );
  }

  /**
   * Generate image using DALL-E format API (/v1/images/generations)
   * Used for nano-banana models with aspect_ratio support
   */
  private async generateImageDalleFormat(
    prompt: string,
    model: string,
    aspectRatio?: string
  ): Promise<{ blob: Blob; objectUrl: string }> {
    try {
      console.log('[BltcyImageClient] Creating DALL-E format request:', { prompt, model, aspectRatio });

      const requestBody: any = {
        model,
        prompt,
        response_format: 'url'
      };

      // Add aspect_ratio if provided
      if (aspectRatio) {
        requestBody.aspect_ratio = aspectRatio;
      }

      console.log('[BltcyImageClient] Request body:', JSON.stringify(requestBody, null, 2));

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
        console.error('[BltcyImageClient] API error response:', errorText);
        throw this.handleApiError(response.status, errorText);
      }

      const data: DalleImageResponse = await response.json();
      console.log('[BltcyImageClient] DALL-E response received:', {
        hasData: Boolean(data.data?.length),
        dataCount: data.data?.length || 0
      });

      if (!data.data || data.data.length === 0) {
        throw new ImageGenerationError(
          'BLTCY API returned no image data',
          'REQUEST_FAILED'
        );
      }

      const imageData = data.data[0];
      let blob: Blob;
      let objectUrl: string;

      if (imageData.url) {
        // URL format - download the image
        console.log('[BltcyImageClient] Downloading image from URL:', imageData.url);
        const imageResponse = await resolveFetch()(imageData.url);
        if (!imageResponse.ok) {
          throw new ImageGenerationError(
            `Failed to download image: HTTP ${imageResponse.status}`,
            'DOWNLOAD_FAILED'
          );
        }
        blob = await imageResponse.blob();
        objectUrl = URL.createObjectURL(blob);
      } else if (imageData.b64_json) {
        // Base64 format
        console.log('[BltcyImageClient] Converting base64 to blob');
        const result = this.base64ToBlob(imageData.b64_json);
        blob = result.blob;
        objectUrl = result.objectUrl;
      } else {
        throw new ImageGenerationError(
          'BLTCY API response missing both url and b64_json',
          'REQUEST_FAILED'
        );
      }

      console.log('[BltcyImageClient] Image generated successfully:', {
        blobSize: blob.size,
        blobType: blob.type,
        objectUrl
      });

      return { blob, objectUrl };
    } catch (error) {
      console.error('[BltcyImageClient] DALL-E generation error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate image using Chat Completions format API (/v1/chat/completions)
   * Used for most models
   */
  private async generateImageChatFormat(
    prompt: string,
    model: string
  ): Promise<{ blob: Blob; objectUrl: string }> {
    try {
      console.log('[BltcyImageClient] Creating Chat format request:', { prompt, model });

      const requestBody = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      };

      console.log('[BltcyImageClient] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await resolveFetch()(`${this.baseURL}/v1/chat/completions`, {
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
        console.error('[BltcyImageClient] API error response:', errorText);
        throw this.handleApiError(response.status, errorText);
      }

      const data: ChatCompletionResponse = await response.json();
      console.log('[BltcyImageClient] Chat response received:', {
        id: data.id,
        hasChoices: Boolean(data.choices?.length),
        choicesCount: data.choices?.length || 0
      });

      if (!data.choices || data.choices.length === 0) {
        throw new ImageGenerationError(
          'BLTCY API returned no choices',
          'REQUEST_FAILED'
        );
      }

      const messageContent = data.choices[0].message?.content;
      if (!messageContent) {
        throw new ImageGenerationError(
          'BLTCY API response missing message content',
          'REQUEST_FAILED'
        );
      }

      console.log('[BltcyImageClient] Message content type:', typeof messageContent);
      console.log('[BltcyImageClient] Message content preview:', messageContent.substring(0, 200));

      return this.parseMessageContent(messageContent);
    } catch (error) {
      console.error('[BltcyImageClient] Chat generation error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Parse message content from Chat Completions response
   * Handles URL, markdown, and base64 formats
   */
  private async parseMessageContent(content: string): Promise<{ blob: Blob; objectUrl: string }> {
    let blob: Blob;
    let objectUrl: string;

    if (content.startsWith('http://') || content.startsWith('https://')) {
      // Direct URL - download the image
      console.log('[BltcyImageClient] Content is a direct URL, downloading...');
      const imageResponse = await resolveFetch()(content);
      if (!imageResponse.ok) {
        throw new ImageGenerationError(
          `Failed to download image from URL: HTTP ${imageResponse.status}`,
          'DOWNLOAD_FAILED'
        );
      }
      blob = await imageResponse.blob();
      objectUrl = URL.createObjectURL(blob);
    } else if (content.includes('![')) {
      // Markdown format - extract URL
      console.log('[BltcyImageClient] Content is markdown format, extracting URL...');
      const urlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
      if (!urlMatch) {
        throw new ImageGenerationError(
          'Failed to extract image URL from markdown format',
          'REQUEST_FAILED'
        );
      }
      const imageUrl = urlMatch[1];
      console.log('[BltcyImageClient] Extracted URL:', imageUrl);
      const imageResponse = await resolveFetch()(imageUrl);
      if (!imageResponse.ok) {
        throw new ImageGenerationError(
          `Failed to download image from URL: HTTP ${imageResponse.status}`,
          'DOWNLOAD_FAILED'
        );
      }
      blob = await imageResponse.blob();
      objectUrl = URL.createObjectURL(blob);
    } else {
      // Assume base64 encoded data
      console.log('[BltcyImageClient] Content assumed to be base64 data');
      const result = this.base64ToBlob(content);
      blob = result.blob;
      objectUrl = result.objectUrl;
    }

    return { blob, objectUrl };
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64Data: string): { blob: Blob; objectUrl: string } {
    // Remove data URL prefix if present
    let cleanBase64 = base64Data;
    const dataUrlMatch = base64Data.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    if (dataUrlMatch) {
      cleanBase64 = dataUrlMatch[1];
    }

    // Convert base64 to blob
    const binaryData = atob(cleanBase64);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }

    // Determine MIME type from magic bytes
    let mimeType = 'image/png'; // Default to PNG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      mimeType = 'image/jpeg';
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      mimeType = 'image/png';
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      mimeType = 'image/webp';
    }

    const blob = new Blob([bytes], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);

    return { blob, objectUrl };
  }

  /**
   * Handle API error responses
   */
  private handleApiError(status: number, errorText: string): ImageGenerationError {
    let errorCode: ImageGenerationError['code'] = 'REQUEST_FAILED';
    let errorMessage = `HTTP ${status}: ${errorText || 'Unknown error'}`;

    if (status === 401) {
      errorCode = 'REQUEST_FAILED';
      errorMessage = 'Invalid BLTCY API key. Please check your configuration.';
    } else if (status === 402) {
      errorCode = 'INSUFFICIENT_CREDITS';
      errorMessage = 'Insufficient credits. Please check your BLTCY account balance.';
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
          'Network error: Cannot connect to BLTCY API. Please check your internet connection.',
          'REQUEST_FAILED'
        );
      } else if (error.message.includes('CORS')) {
        return new ImageGenerationError(
          'CORS error: Cross-origin request blocked.',
          'REQUEST_FAILED'
        );
      }

      return new ImageGenerationError(
        `BLTCY API error: ${error.message}`,
        'REQUEST_FAILED'
      );
    }

    return new ImageGenerationError(
      'Unknown error occurred during image generation',
      'UNKNOWN'
    );
  }
}

function resolveFetch(): typeof fetch {
  const isTauri =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  return isTauri ? (tauriFetch as unknown as typeof fetch) : fetch;
}
