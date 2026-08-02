import { Injectable } from '@nestjs/common';
import {
  CandidateInput,
  EndingPromptInput,
  GameContextInput,
  GameOutcome,
  MoveHistoryEntry,
  PlayerSignalsInput,
  PreviousPredictionInput,
  PromptBuilderInput,
  ReadIndexInput,
} from './prompt-builder.types';

function formatMoveHistory(entries: MoveHistoryEntry[]): string {
  if (entries.length === 0) return '(none yet)';

  const parts: string[] = [];
  let i = 0;

  // Si la primera jugada de la ventana es de negras, la partida arranca a
  // mitad de movimiento y hay que anotarlo con "N... san".
  if (entries[0].ply % 2 === 0) {
    parts.push(`${entries[0].ply / 2}... ${entries[0].san}`);
    i = 1;
  }

  for (; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.ply % 2 === 1) {
      parts.push(`${(entry.ply + 1) / 2}. ${entry.san}`);
    } else {
      parts[parts.length - 1] += ` ${entry.san}`;
    }
  }

  return parts.join(' ');
}

// El motor devuelve centipawns; el prompt usa notación en peones (ej.
// "+0.8") porque es lo que aparece en los ejemplos de PromptStructure.md.
// Nota: los "mate scores" del wrapper de Stockfish llegan colapsados a un
// entero grande (ver stockfish-server/server.js) y se muestran aquí como un
// número de peones grande en vez de "mate en N" — no hay suficiente
// información en este punto del pipeline para distinguirlos.
function formatEval(centipawns: number): string {
  const pawns = centipawns / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

function classifyMsThinking(ms: number): string {
  if (ms < 5000) return 'fast';
  if (ms < 15000) return 'normal';
  if (ms < 30000) return 'slow';
  return 'very slow';
}

function classifyEvalDelta(centipawns: number): string {
  if (centipawns <= -100) return 'worsening';
  if (centipawns >= 100) return 'improving';
  return 'stable';
}

function baseGameContextLines(gameContext: GameContextInput): string[] {
  return [
    'GAME CONTEXT',
    '------------',
    `Player color: ${gameContext.playerColor}`,
    `Difficulty: ${gameContext.difficulty}`,
    `Move history (SAN): ${formatMoveHistory(gameContext.moveHistory)}`,
    `Current phase: ${gameContext.currentPhase}`,
    `Material balance: ${gameContext.materialBalance}`,
    `In check: ${gameContext.inCheck}`,
  ];
}

function buildGameContextSection(input: PromptBuilderInput): string {
  const lines = [
    ...baseGameContextLines(input.gameContext),
    '',
    'CANDIDATES',
    '----------',
    ...input.candidates.map(
      (candidate: CandidateInput, index: number) =>
        `${index}: ${candidate.san}  | eval: ${formatEval(candidate.score)}  | ${candidate.tags.join(', ')}`,
    ),
  ];

  return lines.join('\n');
}

function describeOutcome(outcome: GameOutcome): string {
  if (outcome.status === 'CHECKMATE') {
    return outcome.winner === 'HUMAN'
      ? 'Jaque mate: el jugador te dio mate.'
      : 'Jaque mate: le diste mate al jugador.';
  }
  return 'La partida terminó en tablas.';
}

function buildEndingGameContextSection(input: EndingPromptInput): string {
  const lines = [
    ...baseGameContextLines(input.gameContext),
    '',
    'GAME OUTCOME',
    '------------',
    describeOutcome(input.outcome),
    'La partida ya terminó: no hay candidatas que elegir ni lectura que emitir. Generá solo un comentario de cierre (commentType: ENDING). El valor de chosenCandidate no importa.',
  ];
  return lines.join('\n');
}

function buildSignalsSection(signals: PlayerSignalsInput): string {
  const lines = ['PLAYER SIGNALS', '--------------'];

  if (signals.msThinking !== null) {
    lines.push(
      `msThinking: ${signals.msThinking} (${classifyMsThinking(signals.msThinking)})`,
    );
  }

  const hesitationNote =
    signals.hesitations > 0
      ? ` (picked up and put down a piece ${signals.hesitations === 1 ? 'once' : `${signals.hesitations} times`})`
      : '';
  lines.push(`hesitations: ${signals.hesitations}${hesitationNote}`);

  lines.push(`lastMoveWasBlunder: ${signals.lastMoveWasBlunder}`);

  if (signals.evalDelta !== null) {
    lines.push(
      `evalDelta: ${formatEval(signals.evalDelta)} (${classifyEvalDelta(signals.evalDelta)})`,
    );
  }

  lines.push(
    `repeatedOpening: ${signals.repeatedOpening}${signals.repeatedOpening ? ' (same opening as recent games)' : ''}`,
  );
  lines.push(`defensiveStreak: ${signals.defensiveStreak}`);

  if (signals.lastMoveWasUndo) {
    lines.push('lastMoveWasUndo: true (undid the previous move)');
  }

  return lines.join('\n');
}

// TurnStateMachine.md B6: sin esta sección el LLM no tiene forma de saber si
// debe declararse acertado o equivocado en `verdictText`, aunque el system
// prompt se lo pida (ver la nota en prompt-builder.types.ts).
function buildPreviousPredictionSection(
  prediction: PreviousPredictionInput | null,
): string | null {
  if (!prediction) return null;

  const outcome = prediction.wasCorrect ? 'ACERTASTE' : 'TE EQUIVOCASTE';
  const lines = [
    'PREVIOUS PREDICTION',
    '--------------------',
    `${outcome} en tu predicción del turno anterior.`,
  ];
  if (prediction.readText) {
    lines.push(`Tu insinuación fue: "${prediction.readText}"`);
  }
  lines.push(
    'Generá "verdictText" en tu propia voz reaccionando a este resultado.',
  );
  return lines.join('\n');
}

function buildMemorySection(
  memories: string[],
  readIndex: ReadIndexInput | null,
): string | null {
  if (memories.length === 0 && !readIndex) return null;

  const lines = [
    'PLAYER MEMORY (use at most one per response, naturally)',
    '-------------------------------------------------------',
    ...memories.slice(0, 3).map((memory) => `- ${memory}`),
  ];

  if (readIndex) {
    lines.push(
      `- Read index: ${readIndex.hits}/${readIndex.attempts} correct predictions so far`,
    );
  }

  return lines.join('\n');
}

/**
 * Arma las capas 2-4 del prompt (PromptStructure.md). La capa 1 (system
 * prompt de la personalidad) no pasa por acá: la resuelve quien orquesta el
 * turno con PersonalitiesService y se manda por separado como mensaje de
 * sistema al LLM. Este servicio solo recibe datos ya calculados — no toca
 * BD ni conoce Stockfish/Personalities (ProjectStructure.md).
 */
@Injectable()
export class PromptBuilderService {
  build(input: PromptBuilderInput): string {
    const sections = [
      buildGameContextSection(input),
      buildPreviousPredictionSection(input.previousPrediction),
      buildSignalsSection(input.signals),
      buildMemorySection(input.memories, input.readIndex),
    ].filter((section): section is string => section !== null);

    return sections.join('\n\n');
  }

  /**
   * TurnStateMachine.md B3/B7.5: cuando la partida termina no hay
   * candidatas ni lectura, solo un comentario de cierre.
   */
  buildEndingPrompt(input: EndingPromptInput): string {
    const sections = [
      buildEndingGameContextSection(input),
      buildPreviousPredictionSection(input.previousPrediction),
      buildSignalsSection(input.signals),
      buildMemorySection(input.memories, null),
    ].filter((section): section is string => section !== null);

    return sections.join('\n\n');
  }
}
