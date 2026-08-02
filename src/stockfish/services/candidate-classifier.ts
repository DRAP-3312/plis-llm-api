import { Chess, type Move } from 'chess.js';

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5']);

function uciToMoveInput(uci: string): {
  from: string;
  to: string;
  promotion?: string;
} {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci.slice(4) : undefined,
  };
}

/**
 * Deriva las etiquetas semánticas de una candidata (StockfishIntegration.md)
 * a partir de los flags de chess.js. `defensive` es una heurística propia
 * (el doc describe el criterio pero no un algoritmo): se considera
 * defensiva si, tras la jugada, la pieza movida cubre una pieza propia que
 * el rival amenazaba antes de mover.
 */
export function classifyCandidate(fen: string, uci: string): string[] {
  const before = new Chess(fen);
  const after = new Chess(fen);

  let move: Move;
  try {
    move = after.move(uciToMoveInput(uci));
  } catch {
    return ['developing'];
  }

  const tags: string[] = [];

  if (move.isCapture()) tags.push('aggressive');
  if (after.isCheck()) tags.push('check');
  if (move.isKingsideCastle() || move.isQueensideCastle()) tags.push('castle');
  if (move.piece === 'p' && CENTER_SQUARES.has(move.to))
    tags.push('positional');

  const opponentColor = move.color === 'w' ? 'b' : 'w';
  const defendsSomething = before
    .board()
    .flat()
    .some(
      (piece) =>
        piece !== null &&
        piece.color === move.color &&
        piece.square !== move.from &&
        before.isAttacked(piece.square, opponentColor) &&
        after.attackers(piece.square, move.color).includes(move.to),
    );
  if (defendsSomething) tags.push('defensive');

  if (tags.length === 0) tags.push('developing');
  return tags;
}
