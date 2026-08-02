export interface BuiltPrompt {
  system: string;
  user: string;
}

export type CommentType =
  'COMMENT' | 'BLUNDER' | 'HIT' | 'MISS' | 'OPENING' | 'ENDING';

export type ReadConfidence = 'high' | 'medium' | 'low';

// Siempre válido, nunca se lanza como excepción (LLMErrorHandling.md).
// La validación fina campo-por-campo (Nivel 2, LLMErrorHandling.md) todavía
// no está implementada aquí: por ahora solo se garantiza chosenCandidate,
// que es lo mínimo que TurnService necesita para poder jugar. Eso se
// completa en el paso 5 con LLMValidatorService.
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
