export type ChatRole = 'system' | 'user' | 'assistant';

import { resolveFetch } from './fetchUtils';

export interface ChatMessage {
	role: ChatRole;
	content: string;
}

export interface ChatCompletionParams {
	baseUrl: string;
	model: string;
	messages: ChatMessage[];
	apiKey?: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	timeoutMs?: number;
	endpoint?: string;
	headers?: Record<string, string>;
	reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface ChatCompletionUsage {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
}

export interface ChatCompletionResult {
	content: string;
	usage?: ChatCompletionUsage;
	raw: unknown;
}

export interface StreamChunk {
	content: string;
	isDone: boolean;
}

export class LLMError extends Error {
	status?: number;
	cause?: unknown;

	constructor(message: string, status?: number, cause?: unknown) {
		super(message);
		this.name = 'LLMError';
		this.status = status;
		if (cause !== undefined) {
			this.cause = cause;
		}
	}
}

export function normalizeBaseUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new LLMError('API Base URL cannot be empty');
	}

	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

	let url: URL;
	try {
		url = new URL(withProtocol);
	} catch {
		throw new LLMError('Invalid API Base URL');
	}

	url.hash = '';
	url.search = '';

	const normalizedPath = url.pathname.replace(/\/+$/, '');
	const path = normalizedPath === '/' ? '' : normalizedPath;

	return `${url.origin}${path}`;
}

function buildEndpoint(baseUrl: string, endpoint?: string): string {
	const sanitized = (endpoint ?? '/chat/completions').trim() || '/chat/completions';
			const path = sanitized.startsWith('/') ? sanitized : `/${sanitized}`;
	const cleaned = path.replace(/\/+/g, '/');
	return `${baseUrl}${cleaned}`;
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
	return messages.map((message) => ({
		role: message.role,
		content: (message.content ?? '').toString().trim(),
	}));
}

interface LLMResponseValidation {
	valid: boolean;
	reason: string;
	diagnostics?: {
		hasChoices: boolean;
		choicesLength: number;
		hasFirstChoice: boolean;
		contentType: string;
		textType: string;
	};
}

interface LLMResponseStructure {
	choices?: Array<{
		message?: { content?: unknown };
		text?: unknown;
	}>;
	usage?: {
		prompt_tokens?: number;
		promptTokens?: number;
		completion_tokens?: number;
		completionTokens?: number;
		total_tokens?: number;
		totalTokens?: number;
	};
}

function validateLLMResponse(parsed: unknown): LLMResponseValidation {
	if (!parsed || typeof parsed !== 'object') {
		return { valid: false, reason: 'Response is null/undefined or not an object' };
	}

	const response = parsed as LLMResponseStructure;
	const hasChoices = Array.isArray(response.choices);
	if (!hasChoices) {
		return { 
			valid: false, 
			reason: 'Missing choices array',
			diagnostics: {
				hasChoices: false,
				choicesLength: 0,
				hasFirstChoice: false,
				contentType: 'N/A',
				textType: 'N/A'
			}
		};
	}

	const choices = response.choices;
	const choicesLength = choices?.length ?? 0;

	if (choicesLength === 0) {
		return {
			valid: false,
			reason: 'Empty choices array',
			diagnostics: {
				hasChoices: true,
				choicesLength: 0,
				hasFirstChoice: false,
				contentType: 'N/A',
				textType: 'N/A'
			}
		};
	}

	const primaryChoice = choices?.[0];
	const hasFirstChoice = !!primaryChoice;
	const contentType = typeof primaryChoice?.message?.content;
	const textType = typeof primaryChoice?.text;

	const rawContent: unknown =
		contentType === 'string'
			? primaryChoice?.message?.content
			: textType === 'string'
			? primaryChoice?.text
			: '';

	const content = typeof rawContent === 'string' ? rawContent.trim() : '';

	if (!content) {
		return {
			valid: false,
			reason: 'Content is empty or whitespace-only',
			diagnostics: {
				hasChoices: true,
				choicesLength,
				hasFirstChoice,
				contentType,
				textType
			}
		};
	}

	return { valid: true, reason: 'Valid response' };
}

export async function callChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
	const baseUrl = normalizeBaseUrl(params.baseUrl);
	const url = buildEndpoint(baseUrl, params.endpoint);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		...params.headers,
	};

	if (params.apiKey) {
		headers.Authorization = `Bearer ${params.apiKey}`;
	}

	const payload: Record<string, unknown> = {
		model: params.model,
		messages: sanitizeMessages(params.messages),
		temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
		stream: false,
	};

	if (typeof params.maxTokens === 'number' && Number.isFinite(params.maxTokens)) {
		const rounded = Math.max(1, Math.round(params.maxTokens));
		payload.max_completion_tokens = rounded;
	}

	if (typeof params.topP === 'number' && Number.isFinite(params.topP)) {
		payload.top_p = params.topP;
		payload.topP = params.topP;
	}

	if (params.reasoningEffort) {
		payload.reasoning_effort = params.reasoningEffort;
	}

		const controller = new AbortController();
		let didTimeout = false;
		const timeout = setTimeout(() => {
			didTimeout = true;
			controller.abort();
		}, params.timeoutMs ?? 45000);

	try {
		// Use Tauri's HTTP plugin to avoid CORS preflight issues
		const fetch = resolveFetch();
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		const contentType = response.headers.get('content-type') ?? '';
		const isJson = contentType.includes('application/json');

		if (!response.ok) {
			let detail = '';
			if (isJson) {
				try {
					const errorBody = await response.json();
					detail =
						errorBody?.error?.message ??
						errorBody?.message ??
						(typeof errorBody === 'string' ? errorBody : '');
				} catch {
					// ignore JSON parse failures for error payloads
				}
			} else {
				try {
					detail = await response.text();
				} catch {
					detail = '';
				}
			}

			const message = detail
				? `LLM request failed (${response.status}): ${detail}`
				: `LLM request failed (${response.status}): ${response.statusText}`;
			throw new LLMError(message, response.status);
		}

		if (!isJson) {
			const bodyText = await response.text();
			throw new LLMError(`LLM returned non-JSON content: ${bodyText.slice(0, 200)}`);
		}

		let parsed: unknown;
		try {
			parsed = await response.json();
		} catch (error) {
					throw new LLMError('Failed to parse LLM response JSON', response.status, error);
		}

		// Validate that parsed is an object
		if (!parsed || typeof parsed !== 'object') {
			throw new LLMError('LLM response is not a valid JSON object', response.status);
		}

		const responseData = parsed as LLMResponseStructure;

		// Log response structure for debugging
		const debugContent = responseData.choices?.[0]?.message?.content ?? responseData.choices?.[0]?.text ?? '';
		console.log('[LLM Debug] Response structure:', {
			hasChoices: Array.isArray(responseData.choices),
			choicesLength: responseData.choices?.length ?? 0,
			firstChoice: responseData.choices?.[0] ? {
				hasMessage: !!responseData.choices[0].message,
				hasContent: !!responseData.choices[0].message?.content,
				hasText: !!responseData.choices[0].text,
				contentType: typeof responseData.choices[0].message?.content,
				textType: typeof responseData.choices[0].text,
				contentLength: typeof debugContent === 'string' ? debugContent.length : 0,
				contentPreview: typeof debugContent === 'string' ? `"${debugContent.slice(0, 100)}..."` : 'N/A',
				contentTrimmedLength: typeof debugContent === 'string' ? debugContent.trim().length : 0
			} : null,
			rawSample: JSON.stringify(responseData).slice(0, 500)
		});

		// Validate the response structure
		const validation = validateLLMResponse(responseData);
		
		if (!validation.valid) {
			const contentInfo = typeof debugContent === 'string' && debugContent ? `raw length=${debugContent.length}, trimmed length=${debugContent.trim().length}` : '';
			const diagnosticsStr = validation.diagnostics
				? `Debug info: choices count=${validation.diagnostics.choicesLength}, ` +
				  `primary choice exists=${validation.diagnostics.hasFirstChoice}, ` +
				  `content type=${validation.diagnostics.contentType}, ` +
				  `text type=${validation.diagnostics.textType}` +
				  (contentInfo ? `, ${contentInfo}` : '')
				: '';
			
			console.error('[LLM Error] Invalid response:', {
				reason: validation.reason,
				diagnostics: validation.diagnostics,
				rawContentLength: typeof debugContent === 'string' ? debugContent.length : 0,
				rawContentPreview: typeof debugContent === 'string' ? `"${debugContent.slice(0, 200)}"` : 'N/A',
				fullResponse: responseData
			});

			throw new LLMError(
				`LLM response missing valid content (${validation.reason})。${diagnosticsStr}`,
				response.status
			);
		}

		const choices = Array.isArray(responseData.choices) ? responseData.choices : [];
		const primaryChoice = choices[0] ?? null;
		const rawContent =
			typeof primaryChoice?.message?.content === 'string'
				? primaryChoice.message.content
				: typeof primaryChoice?.text === 'string'
				? primaryChoice.text
				: '';

		const content = rawContent.trim();

		const usage: ChatCompletionUsage | undefined = responseData.usage
			? {
					promptTokens: responseData.usage.prompt_tokens ?? responseData.usage.promptTokens,
					completionTokens: responseData.usage.completion_tokens ?? responseData.usage.completionTokens,
					totalTokens: responseData.usage.total_tokens ?? responseData.usage.totalTokens,
				}
			: undefined;

		return {
			content,
			usage,
			raw: responseData,
		};
	} catch (error) {
		if (error instanceof LLMError) {
			throw error;
		}

		const maybeDom = error as DOMException;
		if (maybeDom?.name === 'AbortError') {
			const message = didTimeout
				? 'LLM request timed out. Please verify the service is running.'
				: 'LLM request was aborted.';
			throw new LLMError(message, didTimeout ? 408 : undefined, error);
		}

		const err = error as Error;
				throw new LLMError(`Error connecting to LLM service: ${err?.message ?? String(error)}`, undefined, error);
			} finally {
				clearTimeout(timeout);
	}
}

export async function callChatCompletionStream(
	params: ChatCompletionParams,
	onChunk: (chunk: StreamChunk) => void
): Promise<void> {
	const baseUrl = normalizeBaseUrl(params.baseUrl);
	const url = buildEndpoint(baseUrl, params.endpoint);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'text/event-stream',
		...params.headers,
	};

	if (params.apiKey) {
		headers.Authorization = `Bearer ${params.apiKey}`;
	}

	const payload: Record<string, unknown> = {
		model: params.model,
		messages: sanitizeMessages(params.messages),
		temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
		stream: true,
	};

	if (typeof params.maxTokens === 'number' && Number.isFinite(params.maxTokens)) {
		const rounded = Math.max(1, Math.round(params.maxTokens));
		payload.max_completion_tokens = rounded;
	}

	if (typeof params.topP === 'number' && Number.isFinite(params.topP)) {
		payload.top_p = params.topP;
		payload.topP = params.topP;
	}

	if (params.reasoningEffort) {
		payload.reasoning_effort = params.reasoningEffort;
	}

	const controller = new AbortController();
	let didTimeout = false;
	const timeout = setTimeout(() => {
		didTimeout = true;
		controller.abort();
	}, params.timeoutMs ?? 120000); // Longer timeout for streaming

	try {
		// Use Tauri's HTTP plugin to avoid CORS preflight issues
		const fetch = resolveFetch();
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		if (!response.ok) {
			const contentType = response.headers.get('content-type') ?? '';
			const isJson = contentType.includes('application/json');
			
			let detail = '';
			if (isJson) {
				try {
					const errorBody = await response.json();
					detail =
						errorBody?.error?.message ??
						errorBody?.message ??
						(typeof errorBody === 'string' ? errorBody : '');
				} catch {
					// ignore JSON parse failures for error payloads
				}
			} else {
				try {
					detail = await response.text();
				} catch {
					detail = '';
				}
			}

			const message = detail
				? `LLM request failed (${response.status}): ${detail}`
				: `LLM request failed (${response.status}): ${response.statusText}`;
			throw new LLMError(message, response.status);
		}

		if (!response.body) {
			throw new LLMError('Response body is empty, cannot perform streaming');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				
				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				
				// Keep the last incomplete line in the buffer
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();

					if (!trimmed || trimmed.startsWith(':')) {
						// Skip empty lines and comments (standard SSE behavior)
						continue;
					}

					if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
						onChunk({ content: '', isDone: true });
						return;
					}

					// More flexible data prefix detection (handles "data:" and "data: ")
					const dataMatch = trimmed.match(/^data:\s*(.+)$/);
					if (dataMatch) {
						const jsonStr = dataMatch[1];

						if (!jsonStr || jsonStr === '[DONE]') {
							// Handle edge case: "data: " followed by [DONE] without space
							onChunk({ content: '', isDone: true });
							return;
						}

						try {
							const parsed = JSON.parse(jsonStr);

							// Extract content from the delta
							const delta = parsed?.choices?.[0]?.delta;
							const content = delta?.content || '';

							if (content) {
								onChunk({ content, isDone: false });
							}
							// Note: empty content is valid (can occur at stream end)
						} catch (error) {
							// Distinguish between malformed JSON and empty chunks
							if (jsonStr.trim().length > 0) {
								console.error('Failed to parse SSE JSON chunk:', {
									line: trimmed,
									jsonStr,
									error: error instanceof Error ? error.message : String(error)
								});
							}
							// Continue processing other chunks
						}
					} else if (trimmed.length > 0) {
						// Non-empty line that doesn't match expected format
						console.warn('Unexpected SSE line format:', trimmed);
					}
				}
			}

			// Stream ended without [DONE] marker
			onChunk({ content: '', isDone: true });
		} finally {
			reader.releaseLock();
		}
	} catch (error) {
		if (error instanceof LLMError) {
			throw error;
		}

		const maybeDom = error as DOMException;
		if (maybeDom?.name === 'AbortError') {
			const message = didTimeout
				? 'LLM streaming request timed out. Please verify the service is running.'
				: 'LLM streaming request was aborted.';
			throw new LLMError(message, didTimeout ? 408 : undefined, error);
		}

		const err = error as Error;
		throw new LLMError(`Error connecting to LLM service: ${err?.message ?? String(error)}`, undefined, error);
	} finally {
		clearTimeout(timeout);
	}
}
