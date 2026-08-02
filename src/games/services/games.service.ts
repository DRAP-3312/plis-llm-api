import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Chess } from 'chess.js';
import { GamesRepository } from '../repositories/games.repository';
import { MovesRepository } from '../repositories/moves.repository';
import { PredictionsRepository } from '../repositories/predictions.repository';
import { TauntsRepository } from '../repositories/taunts.repository';
import {
  Game,
  GameResult,
  GameStatus,
  PlayerColor,
} from '../schemas/game.entity';
import { Move, MoveSide } from '../schemas/move.entity';
import { Taunt, TauntType } from '../schemas/taunt.entity';
import { CreateGameDto } from '../dto/create-game.dto';
import { PlayMoveDto } from '../dto/play-move.dto';
import {
  GameStateResponse,
  MoveHistoryItem,
  UndoResponse,
} from '../games.types';
import { PlayersService } from '../../players/services/players.service';
import { TurnService } from '../../turn/services/turn.service';
import { TurnResult } from '../../turn/turn.types';
import {
  isLegalMove,
  UciMoveInput,
} from '../../turn/services/chess-engine.util';
import { formatMaterialBalance } from '../../turn/services/game-context.util';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Bloque A de TurnStateMachine.md (validaciones) + ciclo de vida de la
 * partida (ProjectStructure.md: "GamesService no orquesta el turno
 * directamente... valida el contexto y luego delega a TurnService").
 */
@Injectable()
export class GamesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(forwardRef(() => TurnService))
    private readonly turnService: TurnService,
    private readonly gamesRepository: GamesRepository,
    private readonly movesRepository: MovesRepository,
    private readonly predictionsRepository: PredictionsRepository,
    private readonly tauntsRepository: TauntsRepository,
    private readonly playersService: PlayersService,
  ) {}

  async createGame(dto: CreateGameDto): Promise<Game> {
    // playerColor: BLACK requeriría que la IA (blancas) mueva primero, sin
    // que exista todavía una jugada del humano — ese flujo no está
    // implementado (decisión explícita: se deja fuera de este alcance).
    if (dto.playerColor === PlayerColor.BLACK) {
      throw new UnprocessableEntityException(
        'playerColor BLACK is not supported yet: the engine cannot open the game on its own',
      );
    }

    const game = this.gamesRepository.create({
      playerId: dto.playerId,
      personalityId: dto.personalityId,
      difficulty: dto.difficulty,
      spiceLevel: dto.spiceLevel,
      playerColor: dto.playerColor,
      initialFen: STARTING_FEN,
      currentFen: STARTING_FEN,
      ply: 0,
      status: GameStatus.ONGOING,
      result: null,
      readHits: 0,
      readAttempts: 0,
      endedAt: null,
      pendingUndoFlag: false,
    });
    return this.gamesRepository.save(game);
  }

  async getGame(id: string): Promise<GameStateResponse> {
    const game = await this.requireGame(id);

    const [moves, taunts, pendingPrediction, readIndex] = await Promise.all([
      this.movesRepository.findByGameId(id),
      this.tauntsRepository.findByGameId(id),
      this.predictionsRepository.findActiveByGameIdAndTargetPly(
        id,
        game.ply + 1,
      ),
      this.playersService.getReadIndex(
        game.playerId,
        game.readHits,
        game.readAttempts,
      ),
    ]);

    return {
      id: game.id,
      status: game.status,
      currentFen: game.currentFen,
      ply: game.ply,
      playerColor: game.playerColor,
      personalityId: game.personalityId,
      difficulty: game.difficulty,
      spiceLevel: game.spiceLevel,
      moveHistory: this.buildMoveHistory(moves, taunts),
      // No se expone `predictedUci`/`alternatives`: el jugador solo ve la
      // insinuación textual (PlisLLM.md: "no revela la jugada exacta").
      pendingRead: pendingPrediction
        ? {
            text: pendingPrediction.readText ?? '',
            confidence: pendingPrediction.declaredConfidence,
          }
        : null,
      readIndex,
    };
  }

  async playMove(gameId: string, dto: PlayMoveDto): Promise<TurnResult> {
    const game = await this.requireGame(gameId);
    this.assertOngoing(game);
    this.assertHumansTurn(game);
    this.assertPlyMatches(game, dto.expectedPly);

    const humanMove: UciMoveInput = {
      from: dto.from,
      to: dto.to,
      promo: dto.promo,
    };
    if (!isLegalMove(game.currentFen, humanMove)) {
      throw new UnprocessableEntityException('illegal move');
    }

    // TurnStateMachine.md, sección undo: el turno siguiente a un undo señala
    // `lastMoveWasUndo: true`. Se consume acá y se limpia en la misma
    // escritura de Game que hace TurnService dentro de su transacción — no
    // hace falta un save separado, `game` es la misma referencia.
    const lastMoveWasUndo = game.pendingUndoFlag;
    game.pendingUndoFlag = false;

    return this.turnService.playTurn({
      game,
      humanMove,
      msThinking: dto.msThinking,
      hesitations: dto.hesitations,
      lastMoveWasUndo,
    });
  }

  async hesitation(gameId: string): Promise<void> {
    // Fire-and-forget (TurnStateMachine.md): en este modelo de datos nunca
    // hay un Move "activo" persistido antes de que el turno completo se
    // confirme en el Bloque C — siempre cae en la salvedad del propio doc
    // ("si no hay Move activo aún, se descarta silenciosamente"). Solo se
    // valida que la partida exista para no aceptar ids basura en silencio.
    await this.requireGame(gameId);
  }

  /**
   * Revierte el turno completo (jugada del humano + respuesta de la IA), no
   * solo la jugada del humano — ver la discusión de diseño: en esta
   * arquitectura el último Move activo siempre es de la IA mientras la
   * partida sigue ONGOING, así que "deshacer solo la última jugada humana"
   * (lectura literal de TurnStateMachine.md) sería casi inalcanzable.
   *
   * No soporta deshacer un turno que terminó la partida: en ese caso
   * PlayerProfile ya se actualizó dentro de la misma transacción del turno,
   * y revertir eso con precisión (en particular `avgMsPerMove`, un promedio
   * acumulado) queda fuera de alcance para un prototipo.
   */
  async undo(gameId: string): Promise<UndoResponse> {
    const game = await this.requireGame(gameId);
    this.assertOngoing(game);

    const activeMoves = (
      await this.movesRepository.findByGameId(gameId)
    ).filter((m) => !m.undone);
    const aiMove = activeMoves[activeMoves.length - 1];
    const humanMove = activeMoves[activeMoves.length - 2];

    if (
      !aiMove ||
      aiMove.side !== MoveSide.AI ||
      !humanMove ||
      humanMove.side !== MoveSide.HUMAN
    ) {
      throw new ConflictException('no move to undo');
    }

    const fenBeforeTurn =
      humanMove.ply === 1
        ? game.initialFen
        : activeMoves.find((m) => m.ply === humanMove.ply - 1)?.fenAfter;
    if (!fenBeforeTurn) {
      throw new ConflictException('cannot undo: missing prior position');
    }

    await this.dataSource.transaction(async (manager) => {
      humanMove.undone = true;
      aiMove.undone = true;
      await this.movesRepository.save(humanMove, manager);
      await this.movesRepository.save(aiMove, manager);

      // Anula la Prediction que este turno generó para el próximo movimiento
      // del humano (B8): ya no aplica, la jugada de la IA que la originó se
      // está deshaciendo.
      const newPrediction =
        await this.predictionsRepository.findActiveByGameIdAndTargetPly(
          gameId,
          aiMove.ply + 1,
        );
      if (newPrediction) {
        newPrediction.voided = true;
        await this.predictionsRepository.save(newPrediction, manager);
        game.readAttempts -= 1;
      }

      // "Des-resuelve" la Prediction que este turno resolvió (B5): vuelve a
      // quedar activa, como si el humano nunca hubiera respondido.
      const resolvedPrediction =
        await this.predictionsRepository.findByResolvedByMoveId(humanMove.id);
      if (resolvedPrediction) {
        if (resolvedPrediction.wasCorrect) {
          game.readHits -= 1;
        }
        resolvedPrediction.wasCorrect = null;
        resolvedPrediction.resolvedByMoveId = null;
        await this.predictionsRepository.save(resolvedPrediction, manager);
      }

      game.currentFen = fenBeforeTurn;
      game.ply = humanMove.ply - 1;
      game.pendingUndoFlag = true;
      await this.gamesRepository.save(game, manager);
    });

    return {
      fen: game.currentFen,
      ply: game.ply,
      status: game.status,
      material: formatMaterialBalance(game.currentFen),
    };
  }

  async resign(gameId: string): Promise<Game> {
    const game = await this.requireGame(gameId);
    this.assertOngoing(game);

    game.status = GameStatus.RESIGNED;
    game.result = GameResult.LOSS;
    game.endedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      await this.gamesRepository.save(game, manager);
      await this.turnService.updatePlayerProfileOnGameEnd(game, manager);
    });

    return game;
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private async requireGame(id: string): Promise<Game> {
    const game = await this.gamesRepository.findById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  private assertOngoing(game: Game): void {
    if (game.status !== GameStatus.ONGOING) {
      throw new ConflictException('game is not active');
    }
  }

  private assertHumansTurn(game: Game): void {
    const turnColor = new Chess(game.currentFen).turn();
    const humanColor = game.playerColor === PlayerColor.WHITE ? 'w' : 'b';
    if (turnColor !== humanColor) {
      throw new ConflictException('not your turn');
    }
  }

  private assertPlyMatches(game: Game, expectedPly: number): void {
    if (expectedPly !== game.ply + 1) {
      throw new ConflictException('ply mismatch, reload the game');
    }
  }

  private buildMoveHistory(moves: Move[], taunts: Taunt[]): MoveHistoryItem[] {
    const tauntsByMoveId = new Map<string, Taunt[]>();
    for (const taunt of taunts) {
      const list = tauntsByMoveId.get(taunt.moveId) ?? [];
      list.push(taunt);
      tauntsByMoveId.set(taunt.moveId, list);
    }

    return moves.map((move) => {
      const moveTaunts = tauntsByMoveId.get(move.id) ?? [];
      const read = moveTaunts.find((t) => t.type === TauntType.READ) ?? null;
      const comment = moveTaunts.find((t) => t.type !== TauntType.READ) ?? null;
      return {
        ply: move.ply,
        side: move.side,
        san: move.san,
        undone: move.undone,
        comment: comment ? { text: comment.text, type: comment.type } : null,
        read: read ? { text: read.text, type: read.type } : null,
      };
    });
  }
}
