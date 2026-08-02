import { GameStatus } from './schemas/game.entity';

export interface MoveHistoryItem {
  ply: number;
  side: 'HUMAN' | 'AI';
  san: string;
  undone: boolean;
  comment: { text: string; type: string } | null;
  read: { text: string; type: string } | null;
}

export interface PendingReadInfo {
  text: string;
  confidence: string | null;
}

/**
 * GET /games/:id (ModeloDatosEndpoints.md: "Reanudar: devuelve fen actual,
 * historial, comentarios y lectura pendiente"). El doc no da un JSON de
 * ejemplo para este endpoint — este shape es el mínimo que el frontend
 * necesita para reconstruir la pantalla sin exponer `predictedUci`.
 */
export interface GameStateResponse {
  id: string;
  status: GameStatus;
  currentFen: string;
  ply: number;
  playerColor: string;
  personalityId: string;
  difficulty: string;
  spiceLevel: string;
  moveHistory: MoveHistoryItem[];
  pendingRead: PendingReadInfo | null;
  readIndex: number;
}

export interface UndoResponse {
  fen: string;
  ply: number;
  status: GameStatus;
  material: string;
}
