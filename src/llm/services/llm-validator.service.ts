import { Injectable } from '@nestjs/common';
import {
  CommentType,
  forcedSilence,
  LLMResult,
  ReadConfidence,
} from '../llm.types';

const VALID_COMMENT_TYPES: readonly string[] = [
  'COMMENT',
  'BLUNDER',
  'HIT',
  'MISS',
  'OPENING',
  'ENDING',
];
const VALID_READ_CONFIDENCES: readonly string[] = ['high', 'medium', 'low'];

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

export interface ValidationContext {
  hadActivePrediction: boolean;
}

export interface ValidationOutcome {
  result: LLMResult;
  /** Nombres de campo afectados, para el log de llm_failure (Nivel 2). */
  fieldsAffected: string[];
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

function toFailureReason(field: string): string {
  switch (field) {
    case 'comment':
      return 'invalid_comment';
    case 'commentType':
      return 'invalid_comment_type';
    case 'read':
      return 'invalid_read';
    case 'readConfidence':
      return 'invalid_confidence';
    case 'verdictText':
      return 'invalid_verdict_text';
    default:
      return field;
  }
}

/**
 * Implementa el "Flujo de validación del response" de LLMErrorHandling.md.
 * Nunca lanza: siempre devuelve un LLMResult utilizable. Los pasos 4 en
 * adelante son independientes entre sí — un fallo en `comment` no afecta la
 * validación de `read`, tal como pide el doc.
 */
@Injectable()
export class LlmValidatorService {
  validate(rawText: string, context: ValidationContext): ValidationOutcome {
    let parsed: RawLlmResponse;
    try {
      parsed = JSON.parse(rawText) as RawLlmResponse;
    } catch {
      return { result: forcedSilence('invalid_json'), fieldsAffected: [] };
    }

    if (!isValidCandidateIndex(parsed.chosenCandidate)) {
      const reason =
        parsed.chosenCandidate === undefined
          ? 'missing_chosen_candidate'
          : 'out_of_range_candidate';
      return { result: forcedSilence(reason), fieldsAffected: [] };
    }

    const fieldsAffected: string[] = [];

    // Paso 4-5: comment / commentType. commentType solo se valida si comment
    // ya es válido (sin tipo no se puede categorizar, ver LLMErrorHandling.md).
    const skipComment = parsed.skipComment === true;
    let comment: string | null = null;
    let commentType: CommentType | null = null;
    if (!skipComment) {
      if (!isNonEmptyString(parsed.comment)) {
        fieldsAffected.push('comment');
      } else if (!isValidCommentType(parsed.commentType)) {
        fieldsAffected.push('commentType');
      } else {
        comment = parsed.comment;
        commentType = parsed.commentType;
      }
    }

    // Paso 6-7: read / readConfidence, mismo criterio que comment/commentType.
    const skipRead = parsed.skipRead === true;
    let read: string | null = null;
    let readConfidence: ReadConfidence | null = null;
    if (!skipRead) {
      if (!isNonEmptyString(parsed.read)) {
        fieldsAffected.push('read');
      } else if (!isValidReadConfidence(parsed.readConfidence)) {
        fieldsAffected.push('readConfidence');
      } else {
        read = parsed.read;
        readConfidence = parsed.readConfidence;
      }
    }

    // Paso 8: verdictText, solo relevante si había una predicción activa.
    let verdictText: string | null = null;
    if (context.hadActivePrediction) {
      if (isNonEmptyString(parsed.verdictText)) {
        verdictText = parsed.verdictText;
      } else {
        fieldsAffected.push('verdictText');
      }
    }

    const degradationLevel = fieldsAffected.length > 0 ? 2 : 0;
    const failureReason =
      fieldsAffected.length > 0
        ? fieldsAffected.map(toFailureReason).join(',')
        : null;

    return {
      result: {
        chosenCandidate: parsed.chosenCandidate,
        comment,
        commentType,
        verdictText,
        read,
        readConfidence,
        degradationLevel,
        failureReason,
      },
      fieldsAffected,
    };
  }
}
