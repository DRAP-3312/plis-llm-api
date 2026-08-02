import { PromptBuilderService } from './prompt-builder.service';
import { EndingPromptInput, PromptBuilderInput } from './prompt-builder.types';

describe('PromptBuilderService', () => {
  const service = new PromptBuilderService();

  const baseInput: PromptBuilderInput = {
    gameContext: {
      playerColor: 'WHITE',
      difficulty: 'NORMAL',
      moveHistory: [
        { ply: 1, san: 'e4' },
        { ply: 2, san: 'e5' },
        { ply: 3, san: 'Nf3' },
        { ply: 4, san: 'Nc6' },
        { ply: 5, san: 'Bb5' },
        { ply: 6, san: 'a6' },
        { ply: 7, san: 'Ba4' },
        { ply: 8, san: 'Nf6' },
        { ply: 9, san: 'O-O' },
        { ply: 10, san: 'Be7' },
      ],
      currentPhase: 'OPENING',
      materialBalance: 'even',
      inCheck: false,
    },
    candidates: [
      { san: 'Nxe5', score: 80, tags: ['capture', 'aggressive'] },
      { san: 'd4', score: 60, tags: ['positional'] },
      { san: 'Re1', score: 50, tags: ['defensive'] },
    ],
    signals: {
      msThinking: 38000,
      hesitations: 2,
      lastMoveWasBlunder: false,
      evalDelta: -10,
      repeatedOpening: true,
      defensiveStreak: 0,
      lastMoveWasUndo: false,
    },
    memories: [],
    readIndex: null,
  };

  it('numbers the move history exactly like the doc example', () => {
    const prompt = service.build(baseInput);
    expect(prompt).toContain(
      'Move history (SAN): 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7',
    );
  });

  it('starts the history with "N... san" when the window begins on black', () => {
    const prompt = service.build({
      ...baseInput,
      gameContext: {
        ...baseInput.gameContext,
        moveHistory: [
          { ply: 5, san: 'Bb5' },
          { ply: 6, san: 'a6' },
        ],
      },
    });
    expect(prompt).toContain('Move history (SAN): 3. Bb5 a6');
  });

  it('renders candidates with 0-indexed labels and formatted eval', () => {
    const prompt = service.build(baseInput);
    expect(prompt).toContain('0: Nxe5  | eval: +0.8  | capture, aggressive');
    expect(prompt).toContain('1: d4  | eval: +0.6  | positional');
    expect(prompt).toContain('2: Re1  | eval: +0.5  | defensive');
  });

  it('classifies a very long thinking time', () => {
    const prompt = service.build(baseInput);
    expect(prompt).toContain('msThinking: 38000 (very slow)');
  });

  it('omits the memory section entirely when there is nothing to say', () => {
    const prompt = service.build(baseInput);
    expect(prompt).not.toContain('PLAYER MEMORY');
  });

  it('includes memories and the read index when present', () => {
    const prompt = service.build({
      ...baseInput,
      memories: ['Dropped the queen on move 9 defending a pawn (3 games ago)'],
      readIndex: { hits: 7, attempts: 10 },
    });
    expect(prompt).toContain(
      '- Dropped the queen on move 9 defending a pawn (3 games ago)',
    );
    expect(prompt).toContain('- Read index: 7/10 correct predictions so far');
  });

  describe('buildEndingPrompt', () => {
    const endingInput: EndingPromptInput = {
      gameContext: baseInput.gameContext,
      outcome: { status: 'CHECKMATE', winner: 'AI' },
      signals: baseInput.signals,
      memories: [],
    };

    it('has no CANDIDATES section', () => {
      const prompt = service.buildEndingPrompt(endingInput);
      expect(prompt).not.toContain('CANDIDATES');
    });

    it('describes the outcome and instructs an ENDING comment', () => {
      const prompt = service.buildEndingPrompt(endingInput);
      expect(prompt).toContain('GAME OUTCOME');
      expect(prompt).toContain('le diste mate al jugador');
      expect(prompt).toContain('commentType: ENDING');
    });

    it('describes a human win differently from an AI win', () => {
      const prompt = service.buildEndingPrompt({
        ...endingInput,
        outcome: { status: 'CHECKMATE', winner: 'HUMAN' },
      });
      expect(prompt).toContain('el jugador te dio mate');
    });

    it('describes a draw with no winner', () => {
      const prompt = service.buildEndingPrompt({
        ...endingInput,
        outcome: { status: 'DRAW', winner: null },
      });
      expect(prompt).toContain('tablas');
    });

    it('never includes a read-index line (no readIndex param exists for endings)', () => {
      const prompt = service.buildEndingPrompt({
        ...endingInput,
        memories: ['Alguna memoria concreta'],
      });
      expect(prompt).toContain('- Alguna memoria concreta');
      expect(prompt).not.toContain('Read index');
    });
  });
});
