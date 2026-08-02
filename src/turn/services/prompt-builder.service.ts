import { Injectable } from '@nestjs/common';
import {
  CandidateInput,
  MoveHistoryEntry,
  PlayerSignalsInput,
  PromptBuilderInput,
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

function buildGameContextSection(input: PromptBuilderInput): string {
  const { gameContext, candidates } = input;

  const lines = [
    'GAME CONTEXT',
    '------------',
    `Player color: ${gameContext.playerColor}`,
    `Difficulty: ${gameContext.difficulty}`,
    `Move history (SAN): ${formatMoveHistory(gameContext.moveHistory)}`,
    `Current phase: ${gameContext.currentPhase}`,
    `Material balance: ${gameContext.materialBalance}`,
    `In check: ${gameContext.inCheck}`,
    '',
    'CANDIDATES',
    '----------',
    ...candidates.map(
      (candidate: CandidateInput, index: number) =>
        `${index}: ${candidate.san}  | eval: ${formatEval(candidate.score)}  | ${candidate.tags.join(', ')}`,
    ),
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

function buildMemorySection(input: PromptBuilderInput): string | null {
  if (input.memories.length === 0 && !input.readIndex) return null;

  const lines = [
    'PLAYER MEMORY (use at most one per response, naturally)',
    '-------------------------------------------------------',
    ...input.memories.slice(0, 3).map((memory) => `- ${memory}`),
  ];

  if (input.readIndex) {
    lines.push(
      `- Read index: ${input.readIndex.hits}/${input.readIndex.attempts} correct predictions so far`,
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
      buildSignalsSection(input.signals),
      buildMemorySection(input),
    ].filter((section): section is string => section !== null);

    return sections.join('\n\n');
  }
}
