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

// Errores de infraestructura normalizados (LLMErrorHandling.md distingue
// "network_error" de "5xx"). Cada LlmClient traduce las excepciones propias
// de su SDK a estas dos clases; así LlmService clasifica el fallo sin
// conocer al proveedor activo.
export class LlmNetworkError extends Error {}
export class LlmServerError extends Error {}
