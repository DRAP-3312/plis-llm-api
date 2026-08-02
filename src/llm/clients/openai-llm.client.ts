import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIConnectionError, APIError } from 'openai';
import {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmNetworkError,
  LlmServerError,
} from './llm-client.interface';

@Injectable()
export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: configService.get<string>('LLM_API_KEY'),
    });
    this.model = configService.get<string>('LLM_MODEL')!;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        // Fuerza JSON puro sin backticks: PromptStructure.md exige que la
        // respuesta sea "JSON puro, sin texto antes ni después".
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      });

      const text = response.choices[0]?.message?.content ?? '';
      const tokensUsed = response.usage?.total_tokens ?? null;
      return { text, tokensUsed };
    } catch (err) {
      // Normaliza a LlmNetworkError/LlmServerError (LLMErrorHandling.md
      // distingue "network_error" de "5xx"); todo lo demás (4xx, etc.) se
      // deja pasar tal cual, LlmService lo trata como network_error genérico.
      if (err instanceof APIConnectionError) {
        throw new LlmNetworkError(err.message);
      }
      if (err instanceof APIError && (err.status ?? 0) >= 500) {
        throw new LlmServerError(err.message);
      }
      throw err;
    }
  }
}
