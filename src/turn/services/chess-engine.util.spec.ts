import {
  applyHumanMove,
  applyUciMove,
  firstLegalMoveUci,
  isPositionInCheck,
  sanForUci,
} from './chess-engine.util';

describe('chess-engine.util', () => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('applies a normal human move and reports no game end', () => {
    const move = applyHumanMove(START_FEN, { from: 'e2', to: 'e4' });
    expect(move.san).toBe('e4');
    expect(move.uci).toBe('e2e4');
    expect(move.isCapture).toBe(false);
    expect(move.isCheck).toBe(false);
    expect(move.isCastle).toBe(false);
    expect(move.capturedPiece).toBeNull();
    expect(move.gameEnd).toBeNull();
  });

  it('detects captures and the captured piece', () => {
    // 1. e4 d5 2. exd5
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    const move = applyUciMove(fen, 'e4d5');
    expect(move.isCapture).toBe(true);
    expect(move.capturedPiece).toBe('p');
  });

  it('detects kingside castling', () => {
    const fen =
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const move = applyUciMove(fen, 'e1g1');
    expect(move.isCastle).toBe(true);
  });

  it('detects checkmate and attributes the win to whoever just moved', () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    const fen =
      'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2';
    const move = applyHumanMove(fen, { from: 'd8', to: 'h4' });
    expect(move.isCheck).toBe(true);
    expect(move.gameEnd).toEqual({ status: 'CHECKMATE', winner: 'HUMAN' });
  });

  it('detects stalemate as a draw with no winner', () => {
    // Posición clásica de ahogado: rey negro en a8 sin jaque pero sin
    // movimientos legales.
    const fen = 'k7/8/1Q6/8/8/8/8/7K b - - 0 1';
    expect(isPositionInCheck(fen)).toBe(false);
    // No hay jugada legal disponible que no sea la del rey (ya ahogado),
    // así que forzamos la detección a través de un motor temporal:
    // aplicamos la última jugada que llevó a esta posición en su lugar.
    // Verificamos ahogado indirectamente vía applyUciMove desde la posición
    // previa (blancas acaban de jugar Qb6).
    const beforeFen = 'k7/8/2Q5/8/8/8/8/7K w - - 0 1';
    const move = applyUciMove(beforeFen, 'c6b6');
    expect(move.gameEnd).toEqual({ status: 'DRAW', winner: null });
  });

  it('sanForUci returns the SAN without mutating any shared state', () => {
    expect(sanForUci(START_FEN, 'e2e4')).toBe('e4');
    expect(sanForUci(START_FEN, 'g1f3')).toBe('Nf3');
  });

  it('firstLegalMoveUci returns a legal uci move from the position', () => {
    const uci = firstLegalMoveUci(START_FEN);
    expect(uci).toMatch(/^[a-h][1-8][a-h][1-8]$/);
  });

  it('firstLegalMoveUci returns null when there are no legal moves', () => {
    const fen = 'k7/8/1Q6/8/8/8/8/7K b - - 0 1'; // ahogado
    expect(firstLegalMoveUci(fen)).toBeNull();
  });
});
