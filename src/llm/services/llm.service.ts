import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLM_CLIENT,
  LlmNetworkError,
  LlmServerError,
} from '../clients/llm-client.interface';
import type { LlmClient } from '../clients/llm-client.interface';
import { BuiltPrompt, forcedSilence, LLMResult } from '../llm.types';
import { LlmValidatorService } from './llm-validator.service';

// PromptStructure.md: "temperatura media-alta (0.8 - 1.0)". Temperatura baja
// produce comentarios repetitivos y predecibles.
const TEMPERATURE = 0.9;

class LlmTimeoutError extends Error {}

function classifyInfraFailure(err: unknown): string {
  if (err instanceof LlmTimeoutError) return 'timeout';
  if (err instanceof LlmServerError) return '5xx';
  if (err instanceof LlmNetworkError) return 'network_error';
  return 'network_error';
}

/**
 * getResponse() nunca lanza: siempre devuelve un LLMResult utilizable
 * (LLMErrorHandling.md). Aplica el timeout de la llamada y clasifica
 * fallos de infraestructura (timeout/network_error/5xx); la validación del
 * JSON en sí (Nivel 1/2) la delega en LlmValidatorService.
 *
 * Nota de alcance: el log de `llm_failure` de LLMErrorHandling.md incluye
 * `gameId`/`ply`, pero ese contexto no existe acá — LlmService no conoce
 * partidas, solo texto y JSON. Se loggea todo lo demás (degradationLevel,
 * reason, elapsedMs, fieldsAffected); si se necesita correlacionar con la
 * partida, TurnService (paso 6) es quien tiene esos datos.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    private readonly configService: ConfigService,
    private readonly validator: LlmValidatorService,
  ) {
    this.timeoutMs = this.configService.get<number>('LLM_TIMEOUT_MS')!;
    this.maxTokens = this.configService.get<number>('LLM_MAX_TOKENS')!;
  }

  async getResponse(prompt: BuiltPrompt): Promise<LLMResult> {
    const startedAt = Date.now();

    let rawText: string;
    try {
      rawText = await this.callWithTimeout(prompt);
    } catch (err) {
      const reason = classifyInfraFailure(err);
      this.logFailure(1, reason, Date.now() - startedAt);
      return forcedSilence(reason);
    }

    const { result, fieldsAffected } = this.validator.validate(rawText, {
      hadActivePrediction: prompt.hadActivePrediction,
    });

    if (result.degradationLevel !== 0) {
      this.logFailure(
        result.degradationLevel,
        result.failureReason ?? 'unknown',
        Date.now() - startedAt,
        fieldsAffected,
      );
    }

    return result;
  }

  private async callWithTimeout(prompt: BuiltPrompt): Promise<string> {
    let timer!: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LlmTimeoutError()), this.timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.llmClient.complete({
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          maxTokens: this.maxTokens,
          temperature: TEMPERATURE,
        }),
        timeout,
      ]);
      return result.text;
    } finally {
      clearTimeout(timer);
    }
  }

  private logFailure(
    degradationLevel: 1 | 2,
    reason: string,
    elapsedMs: number,
    fieldsAffected?: string[],
  ): void {
    this.logger.warn({
      event: 'llm_failure',
      degradationLevel,
      reason,
      elapsedMs,
      ...(fieldsAffected ? { fieldsAffected } : {}),
    });
  }
}
