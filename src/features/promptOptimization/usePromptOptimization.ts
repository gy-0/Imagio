import { useCallback, useEffect, useMemo, useState } from 'react';
import { callChatCompletionStream, LLMError, normalizeBaseUrl } from '../../utils/llmClient';
import type { LLMSettings } from './types';

interface PromptOptimizationState {
  imageStyle: string;
  customDescription: string;
  optimizedPrompt: string;
  isOptimizing: boolean;
  llmStatus: string;
  llmError: string;
}

interface UsePromptOptimizationOptions {
  initialImageStyle?: string;
}

interface UsePromptOptimizationResult extends PromptOptimizationState {
  setImageStyle: (value: string) => void;
  setCustomDescription: (value: string) => void;
  setOptimizedPrompt: (value: string) => void;
  optimizePrompt: () => Promise<void>;
  isLikelyLocalLLM: boolean;
}

export const usePromptOptimization = (
  llmSettings: LLMSettings,
  ocrText: string,
  options: UsePromptOptimizationOptions = {}
): UsePromptOptimizationResult => {
  const { initialImageStyle = 'realistic' } = options;

  const [imageStyle, setImageStyle] = useState<string>(initialImageStyle);
  const [customDescription, setCustomDescription] = useState<string>('');
  const [optimizedPrompt, setOptimizedPrompt] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [llmStatus, setLLMStatus] = useState<string>('');
  const [llmError, setLLMError] = useState<string>('');

  const isLikelyLocalLLM = useMemo(() => {
    try {
      const normalized = normalizeBaseUrl(llmSettings.apiBaseUrl);
      return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(normalized);
    } catch {
      return false;
    }
  }, [llmSettings.apiBaseUrl]);

  useEffect(() => {
    setOptimizedPrompt('');
    setLLMStatus('');
    setLLMError('');
  }, [ocrText]);

  const optimizePrompt = useCallback(async () => {
    setLLMStatus('');
    setLLMError('');

    if (!ocrText.trim()) {
      setLLMError('Please complete OCR and extract text first.');
      return;
    }

    if (!llmSettings.apiBaseUrl.trim()) {
      setLLMError('Please configure API Base URL.');
      return;
    }

    if (!llmSettings.modelName.trim()) {
      setLLMError('Please configure model name.');
      return;
    }

    if (!isLikelyLocalLLM && !llmSettings.apiKey.trim()) {
      setLLMError('Remote LLM service requires an API Key.');
      return;
    }

    setLLMStatus('Generating prompt...');
    setLLMError('');
    setIsOptimizing(true);
    setOptimizedPrompt(''); // Clear previous prompt

    try {
      const systemPrompt = 'You are a prompt optimization expert for image generation models like FLUX. Your task is to transform input text into optimized prompts suitable for image generation. IMPORTANT: Output ONLY the prompt content itself, without any introductory phrases, titles, or explanations like "Concise FLUX prompt" or "Here is the prompt". Start directly with the prompt description.';

      const userPrompt = `Please optimize the following text for image generation with FLUX model:

Extracted text: ${ocrText}

Image style: ${imageStyle}

Additional description: ${customDescription || 'None'}

Generate a concise, descriptive prompt that captures the essence and key visual elements. Focus on visual details, composition, lighting, and style.

CRITICAL: Output ONLY the prompt content. Do NOT include any meta-descriptions, titles, or phrases like "Concise FLUX prompt (anime style):" or "Here is the optimized prompt:". Start directly with the visual description.`;

      let accumulatedPrompt = '';

      await callChatCompletionStream({
        baseUrl: llmSettings.apiBaseUrl,
        apiKey: llmSettings.apiKey || undefined,
        model: llmSettings.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: llmSettings.temperature,
        maxTokens: 8000,
        reasoningEffort: 'minimal' // Minimize reasoning for faster, cheaper prompt optimization
      }, (chunk) => {
        if (!chunk.isDone && chunk.content) {
          accumulatedPrompt += chunk.content;
          setOptimizedPrompt(accumulatedPrompt);
        }
      });

      setLLMStatus('Generated successfully');
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      setLLMStatus('');

      if (error instanceof LLMError) {
        setLLMError(error.message);
      } else if (error instanceof Error) {
        setLLMError(`Unexpected error: ${error.message}`);
      } else {
        setLLMError('An unknown error occurred. Please check the console.');
      }
    } finally {
      setIsOptimizing(false);
    }
  }, [customDescription, imageStyle, isLikelyLocalLLM, llmSettings, ocrText]);

  return {
    imageStyle,
    customDescription,
    optimizedPrompt,
    isOptimizing,
    llmStatus,
    llmError,
    setImageStyle,
    setCustomDescription,
    setOptimizedPrompt,
    optimizePrompt,
    isLikelyLocalLLM
  };
};
