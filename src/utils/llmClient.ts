export type ChatRole = 'system' | 'user' | 'assistant';

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
		throw new LLMError('API Base URL 不能为空');
	}

	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

	let url: URL;
	try {
		url = new URL(withProtocol);
	} catch {
		throw new LLMError('API Base URL 无效');
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
		payload.max_tokens = rounded;
		payload.max_output_tokens = rounded;
	}

	if (typeof params.topP === 'number' && Number.isFinite(params.topP)) {
		payload.top_p = params.topP;
	}

		const controller = new AbortController();
		let didTimeout = false;
		const timeout = setTimeout(() => {
			didTimeout = true;
			controller.abort();
		}, params.timeoutMs ?? 45000);

	try {
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
				? `LLM 请求失败 (${response.status}): ${detail}`
				: `LLM 请求失败 (${response.status}): ${response.statusText}`;
			throw new LLMError(message, response.status);
		}

		if (!isJson) {
			const bodyText = await response.text();
			throw new LLMError(`LLM 返回了非 JSON 内容: ${bodyText.slice(0, 200)}`);
		}

		let parsed: any;
		try {
			parsed = await response.json();
		} catch (error) {
					throw new LLMError('无法解析 LLM 响应 JSON', response.status, error);
		}

		const choices = Array.isArray(parsed?.choices) ? parsed.choices : [];
		const primaryChoice = choices[0] ?? null;
		const rawContent =
			typeof primaryChoice?.message?.content === 'string'
				? primaryChoice.message.content
				: typeof primaryChoice?.text === 'string'
				? primaryChoice.text
				: '';

		const content = rawContent.trim();
		if (!content) {
			throw new LLMError('LLM 响应缺少有效内容', response.status);
		}

		const usage: ChatCompletionUsage | undefined = parsed?.usage
			? {
					promptTokens: parsed.usage.prompt_tokens ?? parsed.usage.promptTokens,
					completionTokens: parsed.usage.completion_tokens ?? parsed.usage.completionTokens,
					totalTokens: parsed.usage.total_tokens ?? parsed.usage.totalTokens,
				}
			: undefined;

		return {
			content,
			usage,
			raw: parsed,
		};
	} catch (error) {
		if (error instanceof LLMError) {
			throw error;
		}

		const maybeDom = error as DOMException;
		if (maybeDom?.name === 'AbortError') {
			const message = didTimeout
				? 'LLM 请求超时，请确认服务已启动。'
				: 'LLM 请求已中断。';
			throw new LLMError(message, didTimeout ? 408 : undefined, error);
		}

		const err = error as Error;
				throw new LLMError(`连接 LLM 服务时出错: ${err?.message ?? String(error)}`, undefined, error);
			} finally {
				clearTimeout(timeout);
	}
}
