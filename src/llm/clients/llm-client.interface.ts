export interface LlmCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmCompletionResult {
  text: string;
  tokensUsed: number | null;
}

// Token de inyección: llm.module.ts elige qué implementación concreta
// (OpenAiLlmClient, y a futuro AnthropicLlmClient, etc.) satisface esta
// interfaz según LLM_PROVIDER. LlmService no conoce el proveedor activo.
export const LLM_CLIENT = Symbol('LLM_CLIENT');

export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
