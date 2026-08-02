export type GamePhase = 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';

export interface MoveHistoryEntry {
  /** Ply global de la partida (1 = primera jugada de blancas). */
  ply: number;
  san: string;
}

export interface GameContextInput {
  playerColor: 'WHITE' | 'BLACK';
  difficulty: 'EASY' | 'NORMAL' | 'HARD';
  /** Ya recortado a las últimas 8 medias-jugadas (PromptStructure.md). */
  moveHistory: MoveHistoryEntry[];
  currentPhase: GamePhase;
  /** Ya formateado, ej. "even", "+2", "-1". */
  materialBalance: string;
  inCheck: boolean;
}

export interface CandidateInput {
  san: string;
  /** Centipawns, perspectiva del jugador activo. */
  score: number;
  tags: string[];
}

export interface PlayerSignalsInput {
  msThinking: number | null;
  hesitations: number;
  lastMoveWasBlunder: boolean;
  /** Centipawns. */
  evalDelta: number | null;
  repeatedOpening: boolean;
  defensiveStreak: number;
  /** TurnStateMachine.md: el turno siguiente a un undo lo señala así. */
  lastMoveWasUndo: boolean;
}

export interface ReadIndexInput {
  hits: number;
  attempts: number;
}

// TurnStateMachine.md B6: "Si hubo predicción: si acertó o no, para que el
// LLM genere el texto del verdict... en consecuencia". Sin esto el LLM no
// tiene forma de saber si debe declararse acertado o equivocado, aunque el
// system prompt le pida `verdictText` — ver la nota en turn.service.ts.
export interface PreviousPredictionInput {
  wasCorrect: boolean;
  /** La insinuación del turno anterior. Ya no es secreta: la predicción ya se resolvió. */
  readText: string | null;
}

export interface PromptBuilderInput {
  gameContext: GameContextInput;
  candidates: CandidateInput[];
  signals: PlayerSignalsInput;
  /** Textos ya resueltos por MemoriesService, máximo 3. */
  memories: string[];
  readIndex: ReadIndexInput | null;
  /** null si no había una predicción activa este turno. */
  previousPrediction: PreviousPredictionInput | null;
}

export interface GameOutcome {
  status: 'CHECKMATE' | 'DRAW';
  winner: 'HUMAN' | 'AI' | null;
}

// TurnStateMachine.md (B3 y B7.5): cuando la partida termina no hay
// candidatas que elegir ni lectura que emitir, solo un comentario de
// cierre (commentType: ENDING).
export interface EndingPromptInput {
  gameContext: GameContextInput;
  outcome: GameOutcome;
  signals: PlayerSignalsInput;
  memories: string[];
  previousPrediction: PreviousPredictionInput | null;
}
