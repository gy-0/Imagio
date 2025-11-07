/**
 * Midjourney Image Generation Client via BLTCY
 * Based on Midjourney API documentation through BLTCY proxy
 */

import { resolveFetch } from '../../../utils/fetchUtils';

export type MidjourneyMode = 'fast' | 'relax';

export interface MidjourneyImageGenerationOptions {
  prompt: string;
  base64Array?: string[]; // For image-to-image (垫图)
}

export interface MidjourneySubmitResponse {
  code: number; // 1 = success, 22 = queued, other = error
  description: string;
  properties: Record<string, unknown>;
  result: string; // Task ID
}

export interface MidjourneyButton {
  customId: string;
  emoji: string;
  label: string;
  style: number; // 2 = Primary, 3 = Green
  type: number;
}

export type MidjourneyTaskStatus =
  | 'NOT_START'
  | 'SUBMITTED'
  | 'MODAL'
  | 'IN_PROGRESS'
  | 'FAILURE'
  | 'SUCCESS';

export interface MidjourneyTaskResponse {
  id: string;
  action: string; // IMAGINE, UPSCALE, VARIATION, ZOOM, PAN, DESCRIBE, BLEND, SHORTEN
  prompt: string;
  promptEn: string;
  description: string;
  state: string;
  submitTime: number;
  startTime: number;
  finishTime: number;
  imageUrl: string;
  status: MidjourneyTaskStatus;
  progress: string; // e.g., "100%"
  failReason: string;
  properties: Record<string, unknown>;
  buttons: MidjourneyButton[];
}

export interface MidjourneyActionOptions {
  customId: string; // Button customId from task response
  taskId: string; // Original task ID
}

export class MidjourneyError extends Error {
  constructor(
    message: string,
    public code: 'INSUFFICIENT_CREDITS' | 'RATE_LIMIT' | 'REQUEST_FAILED' | 'TIMEOUT' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'MidjourneyError';
  }
}

export class MidjourneyClient {
  private baseURL: string;
  private apiKey: string;
  private mode: MidjourneyMode;

  constructor(apiKey: string, mode: MidjourneyMode = 'fast', baseURL: string = 'https://api.bltcy.ai') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.mode = mode;
  }

  /**
   * Generate an image from a prompt using Midjourney
   */
  async generateImage(
    options: MidjourneyImageGenerationOptions,
    onProgress?: (message: string) => void
  ): Promise<{ blob: Blob; objectUrl: string }> {
    const taskId = await this.submitImagineTask(options);

    if (onProgress) {
      onProgress('Task submitted, waiting for generation...');
    }

    const taskResult = await this.pollTaskResult(taskId, onProgress);

    if (!taskResult.imageUrl) {
      throw new MidjourneyError('No image URL in task result', 'REQUEST_FAILED');
    }

    if (onProgress) {
      onProgress('Downloading generated image...');
    }

    return await this.downloadImage(taskResult.imageUrl);
  }

  /**
   * Submit an Imagine task (text-to-image or image-to-image)
   */
  private async submitImagineTask(options: MidjourneyImageGenerationOptions): Promise<string> {
    const modePrefix = this.mode === 'fast' ? 'mj-fast' : 'mj-relax';
    const endpoint = `/${modePrefix}/mj/submit/imagine`;
    const url = `${this.baseURL}${endpoint}`;

    const requestBody = {
      base64Array: options.base64Array || [],
      prompt: options.prompt
    };

    console.log('[MidjourneyClient] Submitting imagine task:', url);
    console.log('[MidjourneyClient] Request body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await resolveFetch()(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MidjourneyClient] API error response:', errorText);

        let errorCode: MidjourneyError['code'] = 'REQUEST_FAILED';
        let errorMessage = `HTTP ${response.status}: ${errorText || 'Unknown error'}`;

        if (response.status === 402) {
          errorCode = 'INSUFFICIENT_CREDITS';
          errorMessage = 'Insufficient credits. Please check your account balance.';
        } else if (response.status === 429) {
          errorCode = 'RATE_LIMIT';
          errorMessage = 'Rate limit exceeded. Please try again later.';
        }

        throw new MidjourneyError(errorMessage, errorCode);
      }

      const data: MidjourneySubmitResponse = await response.json();

      if (data.code !== 1 && data.code !== 22) {
        throw new MidjourneyError(
          `Submit failed: ${data.description || 'Unknown error'}`,
          'REQUEST_FAILED'
        );
      }

      console.log('[MidjourneyClient] Task submitted successfully:', data.result);
      return data.result;
    } catch (error) {
      console.error('[MidjourneyClient] Submit task error:', error);

      if (error instanceof MidjourneyError) {
        throw error;
      }

      let detailedMessage = 'Unknown error';
      if (error instanceof Error) {
        detailedMessage = error.message;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          detailedMessage = 'Network error: Cannot connect to Midjourney API. Please check your internet connection.';
        }
      }

      throw new MidjourneyError(
        `Failed to submit imagine task: ${detailedMessage}`,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * Poll for task completion
   */
  private async pollTaskResult(
    taskId: string,
    onProgress?: (message: string) => void,
    maxAttempts: number = 1200 // 1200 * 0.5s = 10 minutes
  ): Promise<MidjourneyTaskResponse> {
    const modePrefix = this.mode === 'fast' ? 'mj-fast' : 'mj-relax';
    const endpoint = `/${modePrefix}/mj/task`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const url = `${this.baseURL}${endpoint}/${taskId}/fetch`;

        const response = await resolveFetch()(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new MidjourneyError(
            `Failed to fetch task: HTTP ${response.status}`,
            'REQUEST_FAILED'
          );
        }

        const data: MidjourneyTaskResponse = await response.json();

        if (onProgress) {
          onProgress(`Generation progress: ${data.progress || '0%'} - ${data.status}`);
        }

        if (data.status === 'SUCCESS') {
          console.log('[MidjourneyClient] Task completed successfully');
          return data;
        } else if (data.status === 'FAILURE') {
          throw new MidjourneyError(
            `Generation failed: ${data.failReason || 'Unknown error'}`,
            'REQUEST_FAILED'
          );
        }

        // Still in progress, wait before next poll
        console.log(`[MidjourneyClient] Polling attempt ${attempt + 1}/${maxAttempts}: ${data.status} (${data.progress})`);
        await this.sleep(500); // Poll every 0.5 seconds
      } catch (error) {
        if (error instanceof MidjourneyError) {
          throw error;
        }
        throw new MidjourneyError(
          `Failed to poll task result: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'REQUEST_FAILED'
        );
      }
    }

    throw new MidjourneyError(
      'Generation timed out after maximum polling attempts (10 minutes)',
      'TIMEOUT'
    );
  }

  /**
   * Execute an action (button click) on a generated image
   * For example: upscale (U1-U4), variation (V1-V4), reroll, zoom, etc.
   */
  async executeAction(
    options: MidjourneyActionOptions,
    onProgress?: (message: string) => void
  ): Promise<{ blob: Blob; objectUrl: string }> {
    const modePrefix = this.mode === 'fast' ? 'mj-fast' : 'mj-relax';
    const endpoint = `/${modePrefix}/mj/submit/action`;
    const url = `${this.baseURL}${endpoint}`;

    console.log('[MidjourneyClient] Executing action:', options.customId);

    try {
      const response = await resolveFetch()(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new MidjourneyError(
          `Action failed: HTTP ${response.status}: ${errorText}`,
          'REQUEST_FAILED'
        );
      }

      const data: MidjourneySubmitResponse = await response.json();

      if (data.code !== 1 && data.code !== 22) {
        throw new MidjourneyError(
          `Action failed: ${data.description}`,
          'REQUEST_FAILED'
        );
      }

      const newTaskId = data.result;
      console.log('[MidjourneyClient] Action submitted, new task ID:', newTaskId);

      if (onProgress) {
        onProgress('Action submitted, processing...');
      }

      const taskResult = await this.pollTaskResult(newTaskId, onProgress);

      if (!taskResult.imageUrl) {
        throw new MidjourneyError('No image URL in action result', 'REQUEST_FAILED');
      }

      if (onProgress) {
        onProgress('Downloading result image...');
      }

      return await this.downloadImage(taskResult.imageUrl);
    } catch (error) {
      console.error('[MidjourneyClient] Execute action error:', error);

      if (error instanceof MidjourneyError) {
        throw error;
      }

      throw new MidjourneyError(
        `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * Download image from URL and return as blob
   */
  private async downloadImage(imageUrl: string): Promise<{ blob: Blob; objectUrl: string }> {
    try {
      console.log('[MidjourneyClient] Downloading image from:', imageUrl);

      const response = await resolveFetch()(imageUrl, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new MidjourneyError(
          `Failed to download image: HTTP ${response.status}`,
          'REQUEST_FAILED'
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      console.log('[MidjourneyClient] Image downloaded successfully');
      return { blob, objectUrl };
    } catch (error) {
      if (error instanceof MidjourneyError) {
        throw error;
      }
      throw new MidjourneyError(
        `Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
