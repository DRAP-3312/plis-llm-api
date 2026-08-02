import { classifyCandidate } from './candidate-classifier';

describe('classifyCandidate', () => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('tags a pawn push to the center as positional', () => {
    expect(classifyCandidate(START_FEN, 'e2e4')).toEqual(['positional']);
  });

  it('tags a plain knight development with no other flag', () => {
    expect(classifyCandidate(START_FEN, 'g1f3')).toEqual(['developing']);
  });

  it('tags a capture as aggressive (and positional if it lands on center)', () => {
    // 1. e4 d5 2. exd5
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    expect(classifyCandidate(fen, 'e4d5')).toEqual(
      expect.arrayContaining(['aggressive', 'positional']),
    );
  });

  it("tags a checking move as check (fool's mate: 1.f3 e5 2.g4 Qh4#)", () => {
    const fen =
      'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2';
    expect(classifyCandidate(fen, 'd8h4')).toEqual(
      expect.arrayContaining(['check']),
    );
  });

  it('tags kingside castling as castle', () => {
    // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6, white to castle
    const fen =
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(classifyCandidate(fen, 'e1g1')).toEqual(
      expect.arrayContaining(['castle']),
    );
  });

  it('tags a move that shields an already-threatened piece as defensive', () => {
    // 1. e4 e5 2. Nc3 Nf6 (Nf6 threatens the e4 pawn); Qe2 adds a defender
    const fen =
      'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3';
    expect(classifyCandidate(fen, 'd1e2')).toEqual(['defensive']);
  });

  it('falls back to developing when the uci move cannot be applied', () => {
    expect(classifyCandidate(START_FEN, 'e2e5')).toEqual(['developing']);
  });
});
