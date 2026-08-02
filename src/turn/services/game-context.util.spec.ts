import {
  calculateTypingMs,
  computeMaterialDiff,
  detectGamePhase,
  formatMaterialBalance,
} from './game-context.util';

describe('game-context.util', () => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('reports even material at the starting position', () => {
    expect(computeMaterialDiff(START_FEN)).toBe(0);
    expect(formatMaterialBalance(START_FEN)).toBe('even');
  });

  it('reports material advantage with sign after a capture', () => {
    // Blancas capturaron un peón negro sin compensación.
    const fen = 'rnbqkbnr/ppp1pppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2';
    expect(formatMaterialBalance(fen)).toBe('+1');
  });

  it('classifies early plies as OPENING regardless of material', () => {
    expect(detectGamePhase(START_FEN, 4)).toBe('OPENING');
  });

  it('classifies a late position with little material as ENDGAME', () => {
    // Solo reyes y un peón por bando, ply avanzado.
    const fen = '4k3/8/8/4p3/4P3/8/8/4K3 w - - 0 40';
    expect(detectGamePhase(fen, 80)).toBe('ENDGAME');
  });

  it('classifies a late position with lots of material left as MIDDLEGAME', () => {
    expect(detectGamePhase(START_FEN, 25)).toBe('MIDDLEGAME');
  });

  it('keeps typingMs within the documented 800-2500ms range', () => {
    expect(calculateTypingMs(0, false)).toBe(800);
    expect(calculateTypingMs(1000, true)).toBe(2500);
    expect(calculateTypingMs(-50, false)).toBeGreaterThanOrEqual(800);
    expect(calculateTypingMs(-50, false)).toBeLessThanOrEqual(2500);
  });
});
