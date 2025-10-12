export interface LLMSettings {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
}

export interface LocalConfig {
  llm?: Partial<LLMSettings>;
  apiBaseUrl?: string;
  apiKey?: string;
  modelName?: string;
  temperature?: number;
  bflApiKey?: string;
}
