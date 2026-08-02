import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Diferencia de material en peones, positivo a favor de blancas. */
export function computeMaterialDiff(fen: string): number {
  const chess = new Chess(fen);
  let diff = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      diff += piece.color === 'w' ? value : -value;
    }
  }
  return diff;
}

/** "even" | "+2" | "-1", tal como lo espera Capa 2 del prompt. */
export function formatMaterialBalance(fen: string): string {
  const diff = computeMaterialDiff(fen);
  if (diff === 0) return 'even';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// Heurística simple, no hay una definición formal de fase en los docs:
// las primeras 10 jugadas completas son apertura; a partir de ahí, si queda
// poco material sin contar peones y reyes, es final; si no, medio juego.
const OPENING_PLY_LIMIT = 20;
const ENDGAME_NON_PAWN_MATERIAL_THRESHOLD = 14;

export function detectGamePhase(
  fen: string,
  ply: number,
): 'OPENING' | 'MIDDLEGAME' | 'ENDGAME' {
  if (ply < OPENING_PLY_LIMIT) return 'OPENING';

  const chess = new Chess(fen);
  let nonPawnMaterial = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'p' || piece.type === 'k') continue;
      nonPawnMaterial += PIECE_VALUES[piece.type];
    }
  }

  return nonPawnMaterial <= ENDGAME_NON_PAWN_MATERIAL_THRESHOLD
    ? 'ENDGAME'
    : 'MIDDLEGAME';
}

// Rango sugerido por TurnStateMachine.md: 800ms (tranquilo) a 2500ms
// (posición crítica). "Tensión" se aproxima con la magnitud del salto de
// evaluación de la jugada de la IA y si da jaque.
const TYPING_MS_BASE = 800;
const TYPING_MS_MAX = 2500;

export function calculateTypingMs(evalDelta: number, isCheck: boolean): number {
  const tensionBonus = Math.min(Math.abs(evalDelta) * 5, 1500);
  const checkBonus = isCheck ? 200 : 0;
  return Math.min(TYPING_MS_BASE + tensionBonus + checkBonus, TYPING_MS_MAX);
}

// Ninguno de los docs define un umbral exacto de "blunder grave"
// (ModeloDatosEndpoints.md solo dice "valores grandes negativos"). 150
// centipeones (1.5 peones) es una elección razonable: un error real, no una
// imprecisión posicional menor.
export const BLUNDER_THRESHOLD_CENTIPAWNS = 150;

export function isBlunder(evalDelta: number | null): boolean {
  return evalDelta !== null && evalDelta <= -BLUNDER_THRESHOLD_CENTIPAWNS;
}
