import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_CLIENT } from '../clients/llm-client.interface';
import type { LlmClient } from '../clients/llm-client.interface';
import {
  BuiltPrompt,
  CommentType,
  forcedSilence,
  LLMResult,
  ReadConfidence,
} from '../llm.types';

// PromptStructure.md: "temperatura media-alta (0.8 - 1.0)". Temperatura baja
// produce comentarios repetitivos y predecibles.
const TEMPERATURE = 0.9;

const VALID_COMMENT_TYPES: readonly string[] = [
  'COMMENT',
  'BLUNDER',
  'HIT',
  'MISS',
  'OPENING',
  'ENDING',
];
const VALID_READ_CONFIDENCES: readonly string[] = ['high', 'medium', 'low'];

class LlmTimeoutError extends Error {}

interface RawLlmResponse {
  chosenCandidate?: unknown;
  skipComment?: unknown;
  comment?: unknown;
  commentType?: unknown;
  verdictText?: unknown;
  skipRead?: unknown;
  read?: unknown;
  readConfidence?: unknown;
}

function isValidCandidateIndex(value: unknown): value is 0 | 1 | 2 {
  return value === 0 || value === 1 || value === 2;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidCommentType(value: unknown): value is CommentType {
  return typeof value === 'string' && VALID_COMMENT_TYPES.includes(value);
}

function isValidReadConfidence(value: unknown): value is ReadConfidence {
  return typeof value === 'string' && VALID_READ_CONFIDENCES.includes(value);
}

/**
 * getResponse() nunca lanza: siempre devuelve un LLMResult utilizable
 * (LLMErrorHandling.md). Esta versión valida lo mínimo indispensable para
 * TurnService (chosenCandidate + los flags skipComment/skipRead del schema
 * normal). El mapa fino de degradación parcial por campo (Nivel 2) es el
 * paso 5 (LLMValidatorService) y todavía no está aplicado aquí.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    private readonly configService: ConfigService,
  ) {
    this.timeoutMs = this.configService.get<number>('LLM_TIMEOUT_MS')!;
    this.maxTokens = this.configService.get<number>('LLM_MAX_TOKENS')!;
  }

  async getResponse(prompt: BuiltPrompt): Promise<LLMResult> {
    let rawText: string;
    try {
      rawText = await this.callWithTimeout(prompt);
    } catch (err) {
      const reason =
        err instanceof LlmTimeoutError ? 'timeout' : 'network_error';
      this.logFailure(reason, err);
      return forcedSilence(reason);
    }

    let parsed: RawLlmResponse;
    try {
      parsed = JSON.parse(rawText) as RawLlmResponse;
    } catch (err) {
      this.logFailure('invalid_json', err);
      return forcedSilence('invalid_json');
    }

    if (!isValidCandidateIndex(parsed.chosenCandidate)) {
      this.logFailure(
        'missing_or_out_of_range_candidate',
        parsed.chosenCandidate,
      );
      return forcedSilence('missing_or_out_of_range_candidate');
    }

    const skipComment = parsed.skipComment === true;
    const comment =
      !skipComment && isNonEmptyString(parsed.comment) ? parsed.comment : null;
    const commentType =
      comment && isValidCommentType(parsed.commentType)
        ? parsed.commentType
        : null;

    const skipRead = parsed.skipRead === true;
    const read =
      !skipRead && isNonEmptyString(parsed.read) ? parsed.read : null;
    const readConfidence =
      read && isValidReadConfidence(parsed.readConfidence)
        ? parsed.readConfidence
        : null;

    const verdictText = isNonEmptyString(parsed.verdictText)
      ? parsed.verdictText
      : null;

    return {
      chosenCandidate: parsed.chosenCandidate,
      comment,
      commentType,
      verdictText,
      read,
      readConfidence,
      degradationLevel: 0,
      failureReason: null,
    };
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

  private logFailure(reason: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`LLM failure (${reason}): ${message}`);
  }
}
