import { Chess } from 'chess.js';

export interface UciMoveInput {
  from: string;
  to: string;
  promo?: string;
}

export interface GameEndOutcome {
  status: 'CHECKMATE' | 'DRAW';
  /** Quién ganó. null en empate. */
  winner: 'HUMAN' | 'AI' | null;
}

export interface AppliedMove {
  uci: string;
  san: string;
  fenAfter: string;
  isCapture: boolean;
  isCheck: boolean;
  isCastle: boolean;
  capturedPiece: string | null;
  /** null si la partida sigue en curso tras esta jugada. */
  gameEnd: GameEndOutcome | null;
}

function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function detectGameEnd(
  chess: Chess,
  sideThatJustMoved: 'HUMAN' | 'AI',
): GameEndOutcome | null {
  if (chess.isCheckmate()) {
    return { status: 'CHECKMATE', winner: sideThatJustMoved };
  }
  if (chess.isDraw()) {
    return { status: 'DRAW', winner: null };
  }
  return null;
}

/** Aplica {from, to, promo} (la jugada del humano) sobre un FEN con chess.js. */
export function applyHumanMove(fen: string, move: UciMoveInput): AppliedMove {
  const chess = new Chess(fen);
  const result = chess.move({
    from: move.from,
    to: move.to,
    promotion: move.promo,
  });

  return {
    uci: toUci(result),
    san: result.san,
    fenAfter: chess.fen(),
    isCapture: result.isCapture(),
    isCheck: chess.isCheck(),
    isCastle: result.isKingsideCastle() || result.isQueensideCastle(),
    capturedPiece: result.captured ?? null,
    gameEnd: detectGameEnd(chess, 'HUMAN'),
  };
}

/** Aplica una candidata del motor (uci, ej. "e2e4" o "e7e8q") sobre un FEN. */
export function applyUciMove(fen: string, uci: string): AppliedMove {
  const chess = new Chess(fen);
  const result = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci.slice(4) : undefined,
  });

  return {
    uci,
    san: result.san,
    fenAfter: chess.fen(),
    isCapture: result.isCapture(),
    isCheck: chess.isCheck(),
    isCastle: result.isKingsideCastle() || result.isQueensideCastle(),
    capturedPiece: result.captured ?? null,
    gameEnd: detectGameEnd(chess, 'AI'),
  };
}

/** true si la posición actual (a quien le toca mover) está en jaque. */
export function isPositionInCheck(fen: string): boolean {
  return new Chess(fen).isCheck();
}

/** SAN de una candidata del motor (uci), para mostrarla en el prompt. */
export function sanForUci(fen: string, uci: string): string {
  const chess = new Chess(fen);
  const move = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci.slice(4) : undefined,
  });
  return move.san;
}

/**
 * StockfishIntegration.md: si el motor falla en B4, se usa "la primera
 * jugada legal disponible" como fallback de la IA.
 */
export function firstLegalMoveUci(fen: string): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const move = moves[0];
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}
