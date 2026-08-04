import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { GamesService } from './games.service';
import { GamesRepository } from '../repositories/games.repository';
import { MovesRepository } from '../repositories/moves.repository';
import { PredictionsRepository } from '../repositories/predictions.repository';
import { TauntsRepository } from '../repositories/taunts.repository';
import {
  Game,
  GameDifficulty,
  GameResult,
  GameStatus,
  PlayerColor,
  SpiceLevel,
} from '../schemas/game.entity';
import { Move, MoveSide } from '../schemas/move.entity';
import { Prediction } from '../schemas/prediction.entity';
import { PlayMoveDto } from '../dto/play-move.dto';
import { CreateGameDto } from '../dto/create-game.dto';
import { PlayersService } from '../../players/services/players.service';
import { TurnService } from '../../turn/services/turn.service';
import { PlayTurnInput } from '../../turn/turn.types';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// FENs válidas usadas como fixtures en los tests de undo: formatMaterialBalance
// parsea `game.currentFen` con chess.js, así que no alcanza con un string
// cualquiera como "fen-before-turn".
const FEN_AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const FEN_AFTER_E4_E5 =
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

function fakeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    playerId: 'player-1',
    personalityId: 'hater',
    difficulty: GameDifficulty.NORMAL,
    spiceLevel: SpiceLevel.NORMAL,
    playerColor: PlayerColor.WHITE,
    initialFen: STARTING_FEN,
    currentFen: STARTING_FEN,
    ply: 0,
    status: GameStatus.ONGOING,
    result: null,
    readHits: 0,
    readAttempts: 0,
    createdAt: new Date(),
    endedAt: null,
    pendingUndoFlag: false,
    creatorIpHash: 'ip-hash-1',
    ...overrides,
  };
}

function fakeMove(overrides: Partial<Move> = {}): Move {
  return {
    id: 'move-1',
    gameId: 'game-1',
    ply: 1,
    side: MoveSide.HUMAN,
    uci: 'e2e4',
    san: 'e4',
    fenAfter: 'fen-after',
    evalBefore: null,
    evalAfter: null,
    evalDelta: null,
    isCapture: false,
    isCheck: false,
    isCastle: false,
    msThinking: null,
    hesitations: 0,
    undone: false,
    candidatesOffered: null,
    candidateChosen: null,
    ...overrides,
  };
}

function fakePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    id: 'pred-1',
    gameId: 'game-1',
    targetPly: 1,
    predictedUci: 'e7e5',
    alternatives: [],
    engineConfidence: null,
    declaredConfidence: null,
    readText: null,
    wasCorrect: null,
    resolvedByMoveId: null,
    voided: false,
    ...overrides,
  };
}

function validMoveDto(overrides: Partial<PlayMoveDto> = {}): PlayMoveDto {
  return {
    from: 'e2',
    to: 'e4',
    expectedPly: 1,
    msThinking: 1000,
    hesitations: 0,
    ...overrides,
  };
}

interface Saved<T> {
  entity: T;
  manager: unknown;
}

function buildService(opts: {
  game?: Game | null;
  moves?: Move[];
  predictions?: Prediction[];
  completedByPlayer?: number;
  completedByIpToday?: number;
}) {
  const savedGames: Saved<Game>[] = [];
  const savedMoves: Saved<Move>[] = [];
  const savedPredictions: Saved<Prediction>[] = [];
  let playTurnCalledWith: PlayTurnInput | null = null;

  const gamesRepository = {
    create: (data: Partial<Game>) => ({ ...fakeGame(), ...data }),
    save: (game: Game, manager?: unknown) => {
      savedGames.push({ entity: game, manager });
      return Promise.resolve(game);
    },
    findById: () => Promise.resolve(opts.game ?? null),
    countCompletedByPlayerId: () =>
      Promise.resolve(opts.completedByPlayer ?? 0),
    countCompletedByIpHashSince: () =>
      Promise.resolve(opts.completedByIpToday ?? 0),
  } as unknown as GamesRepository;

  const movesRepository = {
    findByGameId: () => Promise.resolve(opts.moves ?? []),
    save: (move: Move, manager?: unknown) => {
      savedMoves.push({ entity: move, manager });
      return Promise.resolve(move);
    },
  } as unknown as MovesRepository;

  const activePredictionsByTargetPly = new Map<number, Prediction>();
  const predictionsByResolvedMoveId = new Map<string, Prediction>();
  for (const prediction of opts.predictions ?? []) {
    if (!prediction.voided) {
      activePredictionsByTargetPly.set(prediction.targetPly, prediction);
    }
    if (prediction.resolvedByMoveId) {
      predictionsByResolvedMoveId.set(prediction.resolvedByMoveId, prediction);
    }
  }

  const predictionsRepository = {
    findActiveByGameIdAndTargetPly: (_gameId: string, targetPly: number) =>
      Promise.resolve(activePredictionsByTargetPly.get(targetPly) ?? null),
    findByResolvedByMoveId: (moveId: string) =>
      Promise.resolve(predictionsByResolvedMoveId.get(moveId) ?? null),
    save: (prediction: Prediction, manager?: unknown) => {
      savedPredictions.push({ entity: prediction, manager });
      return Promise.resolve(prediction);
    },
  } as unknown as PredictionsRepository;

  const tauntsRepository = {
    findByGameId: () => Promise.resolve([]),
  } as unknown as TauntsRepository;

  const playersService = {
    getReadIndex: () => Promise.resolve(0.5),
    getProfile: () => Promise.reject(new Error('no profile in this fake')),
  } as unknown as PlayersService;

  const turnService = {
    playTurn: (input: PlayTurnInput) => {
      playTurnCalledWith = input;
      return Promise.resolve({});
    },
    updatePlayerProfileOnGameEnd: () => Promise.resolve(),
  } as unknown as TurnService;

  const dataSource = {
    transaction: async (cb: (manager: EntityManager) => Promise<void>) =>
      cb({} as EntityManager),
  } as unknown as DataSource;

  const configValues: Record<string, unknown> = {
    IP_HASH_SALT: 'salt',
    GAMES_MAX_COMPLETED_PER_PLAYER: 10,
    GAMES_MAX_COMPLETED_PER_IP_PER_DAY: 30,
  };
  const configService = {
    get: (key: string) => configValues[key],
  } as unknown as ConfigService;

  const service = new GamesService(
    dataSource,
    turnService,
    gamesRepository,
    movesRepository,
    predictionsRepository,
    tauntsRepository,
    playersService,
    configService,
  );

  return {
    service,
    savedGames,
    savedMoves,
    savedPredictions,
    getPlayTurnInput: () => playTurnCalledWith,
  };
}

function validCreateGameDto(overrides: Partial<CreateGameDto> = {}) {
  return {
    personalityId: 'hater',
    difficulty: GameDifficulty.NORMAL,
    playerColor: PlayerColor.WHITE,
    spiceLevel: SpiceLevel.NORMAL,
    ...overrides,
  };
}

describe('GamesService', () => {
  describe('createGame', () => {
    it('starts a new game at the standard starting position', async () => {
      const { service, savedGames } = buildService({});
      const game = await service.createGame(
        'player-1',
        validCreateGameDto(),
        '1.2.3.4',
      );
      expect(game.currentFen).toBe(STARTING_FEN);
      expect(game.status).toBe(GameStatus.ONGOING);
      expect(savedGames).toHaveLength(1);
    });

    it('rejects playerColor BLACK: the engine cannot open the game on its own yet', async () => {
      const { service } = buildService({});
      await expect(
        service.createGame(
          'player-1',
          validCreateGameDto({ playerColor: PlayerColor.BLACK }),
          '1.2.3.4',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects when the account already hit the completed-games limit', async () => {
      const { service } = buildService({ completedByPlayer: 10 });
      await expect(
        service.createGame('player-1', validCreateGameDto(), '1.2.3.4'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the origin IP already hit the daily completed-games cap', async () => {
      const { service } = buildService({ completedByIpToday: 30 });
      await expect(
        service.createGame('player-1', validCreateGameDto(), '1.2.3.4'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('playMove — Bloque A', () => {
    it('throws NotFoundException when the game does not exist', async () => {
      const { service } = buildService({ game: null });
      await expect(
        service.playMove('missing', 'player-1', validMoveDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the game already ended', async () => {
      const { service } = buildService({
        game: fakeGame({ status: GameStatus.CHECKMATE }),
      });
      await expect(
        service.playMove('game-1', 'player-1', validMoveDto()),
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException when it's not the human's turn", async () => {
      const fenBlackToMove =
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const { service } = buildService({
        game: fakeGame({
          currentFen: fenBlackToMove,
          playerColor: PlayerColor.WHITE,
        }),
      });
      await expect(
        service.playMove('game-1', 'player-1', validMoveDto()),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on ply mismatch', async () => {
      const { service } = buildService({ game: fakeGame({ ply: 4 }) });
      await expect(
        service.playMove(
          'game-1',
          'player-1',
          validMoveDto({ expectedPly: 1 }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws UnprocessableEntityException for an illegal move', async () => {
      const { service } = buildService({ game: fakeGame() });
      await expect(
        service.playMove(
          'game-1',
          'player-1',
          validMoveDto({ from: 'e2', to: 'e5' }),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('delegates to TurnService, passing lastMoveWasUndo and clearing pendingUndoFlag', async () => {
      const { service, getPlayTurnInput } = buildService({
        game: fakeGame({ pendingUndoFlag: true }),
      });
      await service.playMove('game-1', 'player-1', validMoveDto());
      const input = getPlayTurnInput()!;
      expect(input.lastMoveWasUndo).toBe(true);
      expect(input.game.pendingUndoFlag).toBe(false);
    });
  });

  describe('hesitation', () => {
    it('resolves silently for an existing game', async () => {
      const { service } = buildService({ game: fakeGame() });
      await expect(
        service.hesitation('game-1', 'player-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException for an unknown game', async () => {
      const { service } = buildService({ game: null });
      await expect(service.hesitation('missing', 'player-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('undo', () => {
    it('throws ConflictException when the game already ended', async () => {
      const { service } = buildService({
        game: fakeGame({ status: GameStatus.DRAW }),
      });
      await expect(service.undo('game-1', 'player-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when there is no human+AI pair to undo', async () => {
      const { service } = buildService({ game: fakeGame(), moves: [] });
      await expect(service.undo('game-1', 'player-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('reverts the full turn: both moves, fen/ply, voids the new prediction and un-resolves the previous one', async () => {
      const priorAiMove = fakeMove({
        id: 'ai-0',
        ply: 2,
        side: MoveSide.AI,
        fenAfter: STARTING_FEN,
      });
      const humanMove = fakeMove({
        id: 'human-1',
        ply: 3,
        side: MoveSide.HUMAN,
        fenAfter: FEN_AFTER_E4,
      });
      const aiMove = fakeMove({
        id: 'ai-1',
        ply: 4,
        side: MoveSide.AI,
        fenAfter: FEN_AFTER_E4_E5,
      });

      const resolvedPrediction = fakePrediction({
        id: 'pred-prev',
        targetPly: 3,
        wasCorrect: true,
        resolvedByMoveId: 'human-1',
      });
      const newPrediction = fakePrediction({
        id: 'pred-new',
        targetPly: 5,
      });

      const game = fakeGame({
        ply: 4,
        currentFen: FEN_AFTER_E4_E5,
        readHits: 1,
        readAttempts: 1,
      });

      const { service, savedMoves, savedPredictions, savedGames } =
        buildService({
          game,
          moves: [priorAiMove, humanMove, aiMove],
          predictions: [resolvedPrediction, newPrediction],
        });

      const result = await service.undo('game-1', 'player-1');

      expect(savedMoves.map((s) => s.entity.id).sort()).toEqual([
        'ai-1',
        'human-1',
      ]);
      expect(humanMove.undone).toBe(true);
      expect(aiMove.undone).toBe(true);

      const savedNew = savedPredictions.find(
        (s) => s.entity.id === 'pred-new',
      )!.entity;
      expect(savedNew.voided).toBe(true);

      const savedResolved = savedPredictions.find(
        (s) => s.entity.id === 'pred-prev',
      )!.entity;
      expect(savedResolved.wasCorrect).toBeNull();
      expect(savedResolved.resolvedByMoveId).toBeNull();

      expect(game.currentFen).toBe(STARTING_FEN);
      expect(game.ply).toBe(2);
      expect(game.readHits).toBe(0);
      expect(game.readAttempts).toBe(0);
      expect(game.pendingUndoFlag).toBe(true);
      expect(savedGames).toHaveLength(1);

      expect(result).toMatchObject({
        fen: STARTING_FEN,
        ply: 2,
        status: GameStatus.ONGOING,
      });
    });

    it('does not touch readHits/readAttempts when there was no prior prediction to resolve or void', async () => {
      const priorAiMove = fakeMove({
        id: 'ai-0',
        ply: 2,
        side: MoveSide.AI,
        fenAfter: STARTING_FEN,
      });
      const humanMove = fakeMove({
        id: 'human-1',
        ply: 3,
        side: MoveSide.HUMAN,
      });
      const aiMove = fakeMove({ id: 'ai-1', ply: 4, side: MoveSide.AI });
      const game = fakeGame({ ply: 4, readHits: 3, readAttempts: 5 });

      const { service } = buildService({
        game,
        moves: [priorAiMove, humanMove, aiMove],
        predictions: [],
      });

      await service.undo('game-1', 'player-1');

      expect(game.readHits).toBe(3);
      expect(game.readAttempts).toBe(5);
    });
  });

  describe('resign', () => {
    it('marks the game RESIGNED/LOSS and folds it into the player profile', async () => {
      const game = fakeGame();
      const { service, savedGames } = buildService({ game });

      const result = await service.resign('game-1', 'player-1');

      expect(result.status).toBe(GameStatus.RESIGNED);
      expect(result.result).toBe(GameResult.LOSS);
      expect(result.endedAt).not.toBeNull();
      expect(savedGames).toHaveLength(1);
    });

    it('throws ConflictException when the game already ended', async () => {
      const { service } = buildService({
        game: fakeGame({ status: GameStatus.RESIGNED }),
      });
      await expect(service.resign('game-1', 'player-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
