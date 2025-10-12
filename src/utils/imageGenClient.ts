/**
 * BFL (Black Forest Labs) FLUX Image Generation Client
 * Based on the FLUX Pro 1.1 Ultra API
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: string;
  outputFormat?: 'jpeg' | 'png';
  safetyTolerance?: number;
}

export interface GenerationResponse {
  id: string;
  status: string;
  polling_url: string;
}

export interface ResultResponse {
  id: string;
  status: 'Pending' | 'Ready' | 'Error';
  result?: {
    sample: string;
  };
  error?: string;
}

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    public code: 'INSUFFICIENT_CREDITS' | 'RATE_LIMIT' | 'REQUEST_FAILED' | 'INVALID_URL' | 'DOWNLOAD_FAILED' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}

export class ImageGenerationClient {
  private baseURL: string;
  private apiKey: string;

  constructor(apiKey: string, baseURL: string = 'https://api.bfl.ai/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Generate an image from a prompt
   */
  async generateImage(options: ImageGenerationOptions): Promise<string> {
    const { requestId, pollingUrl } = await this.createGenerationRequest(options);
    const imageUrl = await this.pollForResult(pollingUrl, requestId);
    return imageUrl;
  }

  /**
   * Create a generation request and return the request ID
   */
  private async createGenerationRequest(options: ImageGenerationOptions): Promise<{ requestId: string; pollingUrl: string }> {
    const url = `${this.baseURL}/flux-pro-1.1-ultra`;

    const requestBody: Record<string, any> = {
      prompt: options.prompt,
      output_format: options.outputFormat || 'jpeg',
      safety_tolerance: options.safetyTolerance ?? 2,
    };

    if (options.aspectRatio) {
      requestBody.aspect_ratio = options.aspectRatio;
    }

    console.log('Creating generation request:', url);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await resolveFetch()(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'x-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);

        let errorCode: ImageGenerationError['code'] = 'REQUEST_FAILED';
        let errorMessage = `HTTP ${response.status}: ${errorText || 'Unknown error'}`;

        if (response.status === 402) {
          errorCode = 'INSUFFICIENT_CREDITS';
          errorMessage = 'Insufficient credits. Please check your BFL account balance.';
        } else if (response.status === 429) {
          errorCode = 'RATE_LIMIT';
          errorMessage = 'Rate limit exceeded. Please try again later.';
        }

        throw new ImageGenerationError(errorMessage, errorCode);
      }

      const data: GenerationResponse = await response.json();
      if (!data.polling_url) {
        throw new ImageGenerationError(
          'API response missing polling URL.',
          'REQUEST_FAILED'
        );
      }

      console.log('Generation request created:', data.id);
      console.log('Polling URL:', data.polling_url);

      return { requestId: data.id, pollingUrl: data.polling_url };
    } catch (error) {
      if (error instanceof ImageGenerationError) {
        throw error;
      }
      throw new ImageGenerationError(
        `Failed to create generation request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * Poll for the result of a generation request
   */
  private async pollForResult(pollingUrl: string, requestId?: string, maxAttempts: number = 120): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await resolveFetch()(pollingUrl, {
          headers: {
            'accept': 'application/json',
            'x-key': this.apiKey,
          },
        });

        if (!response.ok) {
          throw new ImageGenerationError(
            `Failed to get result: HTTP ${response.status}`,
            'REQUEST_FAILED'
          );
        }

        const data: ResultResponse = await response.json();

        if (data.status === 'Ready' && data.result?.sample) {
          console.log('Image ready:', data.result.sample);
          return data.result.sample;
        } else if (data.status === 'Error') {
          throw new ImageGenerationError(
            `Generation failed: ${data.error || 'Unknown error'}`,
            'REQUEST_FAILED'
          );
        }

        // Still pending, wait before next poll
        console.log(`Polling attempt ${attempt + 1}/${maxAttempts} for ${requestId ?? 'request'}: ${data.status}`);
        await this.sleep(500);
      } catch (error) {
        if (error instanceof ImageGenerationError) {
          throw error;
        }
        throw new ImageGenerationError(
          `Failed to poll for result: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'REQUEST_FAILED'
        );
      }
    }

    throw new ImageGenerationError(
      'Generation timed out after maximum polling attempts',
      'REQUEST_FAILED'
    );
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Download an image from a URL and return a blob URL
 */
export interface DownloadedImage {
  blob: Blob;
  objectUrl: string;
}

export async function downloadImageAsBlob(imageUrl: string): Promise<DownloadedImage> {
  try {
    const response = await resolveFetch()(imageUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new ImageGenerationError(
        `Failed to download image: HTTP ${response.status}`,
        'DOWNLOAD_FAILED'
      );
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { blob, objectUrl };
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      throw error;
    }
    throw new ImageGenerationError(
      `Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DOWNLOAD_FAILED'
    );
  }
}

function resolveFetch(): typeof fetch {
  const isTauri =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  return isTauri ? (tauriFetch as unknown as typeof fetch) : fetch;
}
