export interface BuiltPrompt {
  system: string;
  user: string;
  /**
   * Si había una Prediction activa resuelta este turno. Determina si
   * LlmValidatorService debe exigir `verdictText` (LLMErrorHandling.md,
   * paso 8 del flujo de validación) o ignorarlo por completo.
   */
  hadActivePrediction: boolean;
}

export type CommentType =
  'COMMENT' | 'BLUNDER' | 'HIT' | 'MISS' | 'OPENING' | 'ENDING';

export type ReadConfidence = 'high' | 'medium' | 'low';

// Siempre válido, nunca se lanza como excepción (LLMErrorHandling.md).
// La validación campo-por-campo (Nivel 1/2) vive en LlmValidatorService.
export interface LLMResult {
  chosenCandidate: 0 | 1 | 2;
  comment: string | null;
  commentType: CommentType | null;
  verdictText: string | null;
  read: string | null;
  readConfidence: ReadConfidence | null;
  degradationLevel: 0 | 1 | 2;
  failureReason: string | null;
}

export function forcedSilence(failureReason: string): LLMResult {
  return {
    chosenCandidate: 0,
    comment: null,
    commentType: null,
    verdictText: null,
    read: null,
    readConfidence: null,
    degradationLevel: 1,
    failureReason,
  };
}
