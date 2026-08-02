import { Game } from '../games/schemas/game.entity';

export interface HumanMoveInput {
  from: string;
  to: string;
  promo?: string;
}

// Bloque A (validaciones: partida existe/ONGOING/turno del humano/ply/
// legalidad) ya corrió antes de llegar acá — es responsabilidad de
// GamesService (ProjectStructure.md). TurnService arranca en Bloque B
// asumiendo que `humanMove` ya es legal sobre `game.currentFen`.
export interface PlayTurnInput {
  game: Game;
  humanMove: HumanMoveInput;
  msThinking: number;
  hesitations: number;
  /** TurnStateMachine.md, sección undo: lo setea GamesService en el turno siguiente a un undo. */
  lastMoveWasUndo: boolean;
}

export interface TurnVerdict {
  hadPrediction: boolean;
  wasCorrect: boolean | null;
  text: string | null;
}

export interface TurnAiMove {
  uci: string;
  san: string;
  fen: string;
  isCheck: boolean;
  capture: string | null;
}

export interface TurnComment {
  text: string;
  type: string;
}

export interface TurnRead {
  text: string;
  confidence: string;
}

export type MatchPhase = 'ONGOING' | 'CHECKMATE' | 'DRAW' | 'CHECK';

export interface TurnStatus {
  phase: MatchPhase;
  turn: 'HUMAN' | 'AI';
  readIndex: number;
  material: string;
}

export interface TurnResult {
  yourMove: { san: string; fen: string };
  verdict: TurnVerdict;
  aiMove: TurnAiMove | null;
  comment: TurnComment | null;
  read: TurnRead | null;
  status: TurnStatus;
  typingMs: number;
}
