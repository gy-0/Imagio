/**
 * Google Gemini (Nano Banana 🍌) Image Generation Client
 * Based on the Gemini 2.5 Flash Image API
 */

import { GoogleGenAI } from '@google/genai';
import { ImageGenerationError } from './imageGenClient';

export interface GeminiImageGenerationOptions {
  prompt: string;
  aspectRatio?: string;
}

export class GeminiImageClient {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate an image from a prompt using Gemini
   * Returns a blob URL for the generated image
   */
  async generateImage(options: GeminiImageGenerationOptions): Promise<{ blob: Blob; objectUrl: string }> {
    const { prompt, aspectRatio } = options;

    try {
      console.log('[GeminiImageClient] Creating generation request:', { prompt, aspectRatio });

      const config: Record<string, unknown> = {
        responseModalities: ['Image']
      };

      // Add aspect ratio configuration if provided
      if (aspectRatio) {
        config.imageConfig = {
          aspectRatio
        };
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config
      });

      console.log('[GeminiImageClient] Response received:', {
        hasCandidates: Boolean(response.candidates?.length),
        candidatesCount: response.candidates?.length || 0
      });

      // Extract image data from response
      if (!response.candidates || response.candidates.length === 0) {
        throw new ImageGenerationError(
          'Gemini API returned no candidates',
          'REQUEST_FAILED'
        );
      }

      const candidate = response.candidates[0];
      if (!candidate.content?.parts) {
        throw new ImageGenerationError(
          'Gemini API response missing content parts',
          'REQUEST_FAILED'
        );
      }

      // Find the inline data part (base64 image)
      let imageData: string | null = null;
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }

      if (!imageData) {
        throw new ImageGenerationError(
          'Gemini API response missing image data',
          'REQUEST_FAILED'
        );
      }

      console.log('[GeminiImageClient] Image data received, size:', imageData.length);

      // Convert base64 to blob
      const binaryData = atob(imageData);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      // Determine MIME type from the first bytes (magic number)
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

      console.log('[GeminiImageClient] Image generated successfully:', {
        mimeType,
        blobSize: blob.size,
        objectUrl
      });

      return { blob, objectUrl };
    } catch (error) {
      console.error('[GeminiImageClient] Generation error:', error);

      if (error instanceof ImageGenerationError) {
        throw error;
      }

      // Handle API-specific errors
      if (error instanceof Error) {
        // Check for common API errors
        if (error.message.includes('API key')) {
          throw new ImageGenerationError(
            'Invalid Gemini API key. Please check your configuration.',
            'REQUEST_FAILED'
          );
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          throw new ImageGenerationError(
            'Gemini API rate limit exceeded. Please try again later.',
            'RATE_LIMIT'
          );
        }

        throw new ImageGenerationError(
          `Gemini API error: ${error.message}`,
          'REQUEST_FAILED'
        );
      }

      throw new ImageGenerationError(
        'Unknown error occurred during image generation',
        'UNKNOWN'
      );
    }
  }
}
