import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StockfishService } from '../../stockfish/services/stockfish.service';
import { classifyCandidate } from '../../stockfish/services/candidate-classifier';
import { LlmService } from '../../llm/services/llm.service';
import { LLMResult } from '../../llm/llm.types';
import { PersonalitiesService } from '../../personalities/services/personalities.service';
import { MemoriesService } from '../../memories/services/memories.service';
import { MemoryType } from '../../memories/schemas/memory.entity';
import { PlayersService } from '../../players/services/players.service';
import { GamesRepository } from '../../games/repositories/games.repository';
import { MovesRepository } from '../../games/repositories/moves.repository';
import { PredictionsRepository } from '../../games/repositories/predictions.repository';
import { TauntsRepository } from '../../games/repositories/taunts.repository';
import {
  Game,
  GameResult,
  GameStatus,
  PlayerColor,
} from '../../games/schemas/game.entity';
import {
  Move,
  MoveSide,
  OfferedCandidate,
} from '../../games/schemas/move.entity';
import { Prediction } from '../../games/schemas/prediction.entity';
import { TauntType } from '../../games/schemas/taunt.entity';
import { PromptBuilderService } from './prompt-builder.service';
import {
  CandidateInput,
  GameOutcome,
  MoveHistoryEntry,
  PlayerSignalsInput,
} from './prompt-builder.types';
import {
  applyHumanMove,
  applyUciMove,
  AppliedMove,
  firstLegalMoveUci,
  sanForUci,
} from './chess-engine.util';
import {
  calculateTypingMs,
  detectGamePhase,
  formatMaterialBalance,
  isBlunder,
} from './game-context.util';
import {
  toPersonalitiesSpiceLevel,
  toPromptDifficulty,
  toPromptPlayerColor,
} from './type-bridge.util';
import {
  MatchPhase,
  PlayTurnInput,
  TurnComment,
  TurnResult,
} from '../turn.types';

const MOVE_HISTORY_WINDOW = 8;
const RELEVANT_MEMORIES_LIMIT = 3;
const DEFENSIVE_STREAK_LOOKBACK = 8;
const REPEATED_OPENING_THRESHOLD = 3;

interface PreviousPredictionOutcome {
  hadPrediction: boolean;
  wasCorrect: boolean | null;
  activePrediction: Prediction | null;
}

/**
 * Orquesta el Bloque B (procesamiento) y Bloque C (transacción + response)
 * de TurnStateMachine.md. El Bloque A (partida existe/ONGOING/turno del
 * humano/ply/legalidad) corre antes de esto, en GamesService — acá se
 * asume que `input.humanMove` ya es legal sobre `game.currentFen`.
 */
@Injectable()
export class TurnService {
  private readonly logger = new Logger(TurnService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stockfishService: StockfishService,
    private readonly llmService: LlmService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly personalitiesService: PersonalitiesService,
    private readonly memoriesService: MemoriesService,
    private readonly playersService: PlayersService,
    private readonly gamesRepository: GamesRepository,
    private readonly movesRepository: MovesRepository,
    private readonly predictionsRepository: PredictionsRepository,
    private readonly tauntsRepository: TauntsRepository,
  ) {}

  async playTurn(input: PlayTurnInput): Promise<TurnResult> {
    const { game } = input;
    const humanPly = game.ply + 1;

    // B1
    const evalBefore = await this.stockfishService.getEvaluation(
      game.currentFen,
    );

    // B2
    const humanApplied = applyHumanMove(game.currentFen, input.humanMove);

    // B5 (el booleano se resuelve siempre, sin importar qué pase después)
    const previousPrediction = await this.resolvePreviousPrediction(
      game.id,
      humanPly,
      humanApplied.uci,
    );

    // B3
    if (humanApplied.gameEnd) {
      return this.finishWithHumanEndingTheGame({
        game,
        input,
        humanPly,
        evalBefore,
        humanApplied,
        previousPrediction,
      });
    }

    return this.continueTurnWithAiMove({
      game,
      input,
      humanPly,
      evalBefore,
      humanApplied,
      previousPrediction,
    });
  }

  // ---------------------------------------------------------------------
  // Camino normal: el humano no terminó la partida, la IA responde.
  // ---------------------------------------------------------------------
  private async continueTurnWithAiMove(params: {
    game: Game;
    input: PlayTurnInput;
    humanPly: number;
    evalBefore: number | null;
    humanApplied: AppliedMove;
    previousPrediction: PreviousPredictionOutcome;
  }): Promise<TurnResult> {
    const {
      game,
      input,
      humanPly,
      evalBefore,
      humanApplied,
      previousPrediction,
    } = params;

    const systemPrompt = this.personalitiesService.getSystemPrompt(
      game.personalityId,
      toPersonalitiesSpiceLevel(game.spiceLevel),
    );

    // B4
    const candidatesResult = await this.stockfishService.getCandidates(
      humanApplied.fenAfter,
      game.difficulty,
    );
    const evalAfter = candidatesResult?.bestScore ?? null;
    const evalDelta =
      evalBefore !== null && evalAfter !== null ? evalAfter - evalBefore : null;

    const engineFailedAtB4 = candidatesResult === null;

    let llmResult: LLMResult;
    let offeredCandidates: OfferedCandidate[] | null = null;

    if (engineFailedAtB4) {
      // StockfishIntegration.md: sin candidatas, silencio forzado directo,
      // ni siquiera se llama al LLM (no hay nada que elegir).
      llmResult = {
        chosenCandidate: 0,
        comment: null,
        commentType: null,
        verdictText: null,
        read: null,
        readConfidence: null,
        degradationLevel: 1,
        failureReason: 'engine_failure',
      };
    } else {
      offeredCandidates = candidatesResult.candidates.map((c) => ({
        uci: c.uci,
        score: c.score,
        tags: c.tags,
      }));

      const signals = await this.buildSignals({
        game,
        humanPly,
        evalDelta,
        msThinking: input.msThinking,
        hesitations: input.hesitations,
        lastMoveWasUndo: input.lastMoveWasUndo,
        humanFenBefore: game.currentFen,
        humanUci: humanApplied.uci,
        humanSan: humanApplied.san,
      });

      const moveHistory = await this.buildMoveHistory(game.id, [
        { ply: humanPly, san: humanApplied.san },
      ]);
      const memories = await this.memoriesService.getRelevantMemories(
        game.playerId,
        RELEVANT_MEMORIES_LIMIT,
      );

      const candidateInputs: CandidateInput[] = candidatesResult.candidates.map(
        (c) => ({
          san: sanForUci(humanApplied.fenAfter, c.uci),
          score: c.score,
          tags: c.tags,
        }),
      );

      const userPrompt = this.promptBuilderService.build({
        gameContext: {
          playerColor: toPromptPlayerColor(game.playerColor),
          difficulty: toPromptDifficulty(game.difficulty),
          moveHistory,
          currentPhase: detectGamePhase(humanApplied.fenAfter, humanPly),
          materialBalance: formatMaterialBalance(humanApplied.fenAfter),
          inCheck: humanApplied.isCheck,
        },
        candidates: candidateInputs,
        signals,
        memories: memories.map((m) => m.text),
        readIndex: { hits: game.readHits, attempts: game.readAttempts },
      });

      llmResult = await this.llmService.getResponse({
        system: systemPrompt,
        user: userPrompt,
        hadActivePrediction: previousPrediction.hadPrediction,
      });
    }

    const forcedSilence = engineFailedAtB4 || llmResult.degradationLevel === 1;

    // B7 — candidata 0 si hubo silencio forzado en cualquiera de los dos pasos.
    const aiSourceUci = engineFailedAtB4
      ? this.fallbackLegalMove(humanApplied.fenAfter)
      : candidatesResult.candidates[
          forcedSilence ? 0 : llmResult.chosenCandidate
        ].uci;

    const aiApplied = applyUciMove(humanApplied.fenAfter, aiSourceUci);
    const aiPly = humanPly + 1;

    // B7.5 — comentario de cierre si la jugada de la IA termina la partida.
    let endingComment: TurnComment | null = null;
    if (aiApplied.gameEnd && !forcedSilence) {
      endingComment = await this.buildEndingComment({
        game,
        systemPrompt,
        fenBeforeOutcome: aiApplied.fenAfter,
        ply: aiPly,
        outcome: aiApplied.gameEnd,
        hadPrediction: previousPrediction.hadPrediction,
        signalsBase: {
          msThinking: null,
          hesitations: 0,
          lastMoveWasBlunder: isBlunder(evalDelta),
          evalDelta,
          repeatedOpening: false,
          defensiveStreak: 0,
          lastMoveWasUndo: input.lastMoveWasUndo,
        },
        pendingMoveEntries: [
          { ply: humanPly, san: humanApplied.san },
          { ply: aiPly, san: aiApplied.san },
        ],
      });
    }

    // B8 — nueva predicción, solo si sigue en curso, sin silencio forzado, y
    // el LLM sí emitió una lectura (LLMErrorHandling.md: sin read, no hay
    // Prediction este turno).
    let newPrediction: Prediction | null = null;
    if (!aiApplied.gameEnd && !forcedSilence && llmResult.read !== null) {
      const predictionEngineResult = await this.stockfishService.getPrediction(
        aiApplied.fenAfter,
      );
      if (
        predictionEngineResult &&
        predictionEngineResult.candidates.length > 0
      ) {
        const [best, second] = predictionEngineResult.candidates;
        newPrediction = this.predictionsRepository.create({
          gameId: game.id,
          targetPly: aiPly + 1,
          predictedUci: best.uci,
          alternatives: predictionEngineResult.candidates.map((c) => ({
            uci: c.uci,
            score: c.score,
          })),
          engineConfidence: second ? best.score - second.score : null,
          declaredConfidence: llmResult.readConfidence,
          readText: llmResult.read,
          wasCorrect: null,
          resolvedByMoveId: null,
          voided: false,
        });
      }
    }

    const humanMoveEntity = this.movesRepository.create({
      gameId: game.id,
      ply: humanPly,
      side: MoveSide.HUMAN,
      uci: humanApplied.uci,
      san: humanApplied.san,
      fenAfter: humanApplied.fenAfter,
      evalBefore,
      evalAfter,
      evalDelta,
      isCapture: humanApplied.isCapture,
      isCheck: humanApplied.isCheck,
      isCastle: humanApplied.isCastle,
      msThinking: input.msThinking,
      hesitations: input.hesitations,
      undone: false,
      candidatesOffered: null,
      candidateChosen: null,
    });

    const aiMoveEntity = this.movesRepository.create({
      gameId: game.id,
      ply: aiPly,
      side: MoveSide.AI,
      uci: aiApplied.uci,
      san: aiApplied.san,
      fenAfter: aiApplied.fenAfter,
      evalBefore: evalAfter,
      evalAfter: null,
      evalDelta: null,
      isCapture: aiApplied.isCapture,
      isCheck: aiApplied.isCheck,
      isCastle: aiApplied.isCastle,
      msThinking: null,
      hesitations: 0,
      undone: false,
      candidatesOffered: offeredCandidates,
      candidateChosen: forcedSilence ? null : llmResult.chosenCandidate,
    });

    this.applyOutcomeToGame(game, aiApplied.gameEnd, aiApplied.fenAfter, aiPly);
    if (previousPrediction.hadPrediction && previousPrediction.wasCorrect) {
      game.readHits += 1;
    }
    if (newPrediction) {
      game.readAttempts += 1;
    }

    const finalComment =
      endingComment ??
      (llmResult.comment
        ? { text: llmResult.comment, type: llmResult.commentType ?? 'COMMENT' }
        : null);

    await this.dataSource.transaction(async (manager) => {
      await this.persistTurn(manager, {
        game,
        humanMoveEntity,
        aiMoveEntity,
        previousPrediction,
        newPrediction,
        forcedSilence,
        finalComment,
        llmResult,
        evalDelta,
        humanPly,
      });
    });

    const readIndex = await this.computeGlobalReadIndex(game);
    const typingMs = calculateTypingMs(evalDelta ?? 0, aiApplied.isCheck);

    return {
      yourMove: { san: humanApplied.san, fen: humanApplied.fenAfter },
      verdict: {
        hadPrediction: previousPrediction.hadPrediction,
        wasCorrect: previousPrediction.wasCorrect,
        text: llmResult.verdictText,
      },
      aiMove: {
        uci: aiApplied.uci,
        san: aiApplied.san,
        fen: aiApplied.fenAfter,
        isCheck: aiApplied.isCheck,
        capture: aiApplied.capturedPiece,
      },
      comment: finalComment,
      read: llmResult.read
        ? {
            text: llmResult.read,
            confidence: llmResult.readConfidence ?? 'medium',
          }
        : null,
      status: {
        phase: this.computeMatchPhase(aiApplied.gameEnd, aiApplied.isCheck),
        turn: 'HUMAN',
        readIndex,
        material: formatMaterialBalance(aiApplied.fenAfter),
      },
      typingMs,
    };
  }

  // ---------------------------------------------------------------------
  // Camino corto: la jugada del humano ya termina la partida (B3). No hay
  // candidatas, ni jugada de IA, ni nueva predicción — solo un cierre.
  // ---------------------------------------------------------------------
  private async finishWithHumanEndingTheGame(params: {
    game: Game;
    input: PlayTurnInput;
    humanPly: number;
    evalBefore: number | null;
    humanApplied: AppliedMove;
    previousPrediction: PreviousPredictionOutcome;
  }): Promise<TurnResult> {
    const {
      game,
      input,
      humanPly,
      evalBefore,
      humanApplied,
      previousPrediction,
    } = params;

    const systemPrompt = this.personalitiesService.getSystemPrompt(
      game.personalityId,
      toPersonalitiesSpiceLevel(game.spiceLevel),
    );

    const endingComment = await this.buildEndingComment({
      game,
      systemPrompt,
      fenBeforeOutcome: humanApplied.fenAfter,
      ply: humanPly,
      outcome: humanApplied.gameEnd!,
      hadPrediction: previousPrediction.hadPrediction,
      signalsBase: {
        msThinking: input.msThinking,
        hesitations: input.hesitations,
        lastMoveWasBlunder: false,
        evalDelta: null,
        repeatedOpening: false,
        defensiveStreak: 0,
        lastMoveWasUndo: input.lastMoveWasUndo,
      },
      pendingMoveEntries: [{ ply: humanPly, san: humanApplied.san }],
    });

    const humanMoveEntity = this.movesRepository.create({
      gameId: game.id,
      ply: humanPly,
      side: MoveSide.HUMAN,
      uci: humanApplied.uci,
      san: humanApplied.san,
      fenAfter: humanApplied.fenAfter,
      evalBefore,
      evalAfter: null,
      evalDelta: null,
      isCapture: humanApplied.isCapture,
      isCheck: humanApplied.isCheck,
      isCastle: humanApplied.isCastle,
      msThinking: input.msThinking,
      hesitations: input.hesitations,
      undone: false,
      candidatesOffered: null,
      candidateChosen: null,
    });

    this.applyOutcomeToGame(
      game,
      humanApplied.gameEnd,
      humanApplied.fenAfter,
      humanPly,
    );

    await this.dataSource.transaction(async (manager) => {
      await this.persistTurn(manager, {
        game,
        humanMoveEntity,
        aiMoveEntity: null,
        previousPrediction,
        newPrediction: null,
        forcedSilence: false,
        finalComment: endingComment,
        llmResult: null,
        evalDelta: null,
        humanPly,
      });
    });

    const readIndex = await this.computeGlobalReadIndex(game);

    return {
      yourMove: { san: humanApplied.san, fen: humanApplied.fenAfter },
      verdict: {
        hadPrediction: previousPrediction.hadPrediction,
        wasCorrect: previousPrediction.wasCorrect,
        text: null,
      },
      aiMove: null,
      comment: endingComment,
      read: null,
      status: {
        phase: this.computeMatchPhase(humanApplied.gameEnd, false),
        turn: 'AI',
        readIndex,
        material: formatMaterialBalance(humanApplied.fenAfter),
      },
      typingMs: calculateTypingMs(0, false),
    };
  }

  // ---------------------------------------------------------------------
  // Persistencia (Bloque C1) — todo dentro de una sola transacción.
  // ---------------------------------------------------------------------
  private async persistTurn(
    manager: EntityManager,
    params: {
      game: Game;
      humanMoveEntity: Move;
      aiMoveEntity: Move | null;
      previousPrediction: PreviousPredictionOutcome;
      newPrediction: Prediction | null;
      forcedSilence: boolean;
      finalComment: TurnComment | null;
      llmResult: LLMResult | null;
      evalDelta: number | null;
      humanPly: number;
    },
  ): Promise<void> {
    const {
      game,
      humanMoveEntity,
      aiMoveEntity,
      previousPrediction,
      newPrediction,
      forcedSilence,
      finalComment,
      llmResult,
      evalDelta,
      humanPly,
    } = params;

    await this.movesRepository.save(humanMoveEntity, manager);

    if (previousPrediction.activePrediction) {
      previousPrediction.activePrediction.wasCorrect =
        previousPrediction.wasCorrect;
      previousPrediction.activePrediction.resolvedByMoveId = humanMoveEntity.id;
      await this.predictionsRepository.save(
        previousPrediction.activePrediction,
        manager,
      );
    }

    if (aiMoveEntity) {
      await this.movesRepository.save(aiMoveEntity, manager);
    }

    if (newPrediction) {
      await this.predictionsRepository.save(newPrediction, manager);
    }

    await this.gamesRepository.save(game, manager);

    if (!forcedSilence && aiMoveEntity) {
      if (finalComment) {
        await this.tauntsRepository.save(
          this.tauntsRepository.create({
            gameId: game.id,
            moveId: aiMoveEntity.id,
            personalityId: game.personalityId,
            type: finalComment.type as TauntType,
            text: finalComment.text,
            themeTag: null,
            model: null,
            tokens: null,
            latencyMs: null,
            wasFallback: false,
          }),
          manager,
        );
      }
      if (llmResult?.read) {
        await this.tauntsRepository.save(
          this.tauntsRepository.create({
            gameId: game.id,
            moveId: aiMoveEntity.id,
            personalityId: game.personalityId,
            type: TauntType.READ,
            text: llmResult.read,
            themeTag: null,
            model: null,
            tokens: null,
            latencyMs: null,
            wasFallback: false,
          }),
          manager,
        );
      }
    } else if (finalComment && !aiMoveEntity) {
      // El humano terminó la partida: el comentario de cierre queda
      // asociado a su propia jugada, no hay Move de la IA.
      await this.tauntsRepository.save(
        this.tauntsRepository.create({
          gameId: game.id,
          moveId: humanMoveEntity.id,
          personalityId: game.personalityId,
          type: TauntType.ENDING,
          text: finalComment.text,
          themeTag: null,
          model: null,
          tokens: null,
          latencyMs: null,
          wasFallback: false,
        }),
        manager,
      );
    }

    if (isBlunder(evalDelta)) {
      await this.memoriesService.createMemory(
        {
          playerId: game.playerId,
          gameId: game.id,
          type: MemoryType.BLUNDER,
          text: `Blunder en la jugada ${humanPly}: perdió cerca de ${(
            Math.abs(evalDelta!) / 100
          ).toFixed(1)} peones de evaluación.`,
          weight: Math.min(Math.round(Math.abs(evalDelta!) / 20), 10),
        },
        manager,
      );
    }

    if (game.status !== GameStatus.ONGOING) {
      await this.updatePlayerProfileOnGameEnd(game, manager);
    }
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private async resolvePreviousPrediction(
    gameId: string,
    humanPly: number,
    humanUci: string,
  ): Promise<PreviousPredictionOutcome> {
    const activePrediction =
      await this.predictionsRepository.findActiveByGameIdAndTargetPly(
        gameId,
        humanPly,
      );
    if (!activePrediction) {
      return { hadPrediction: false, wasCorrect: null, activePrediction: null };
    }
    return {
      hadPrediction: true,
      wasCorrect: activePrediction.predictedUci === humanUci,
      activePrediction,
    };
  }

  private fallbackLegalMove(fen: string): string {
    const uci = firstLegalMoveUci(fen);
    if (!uci) {
      // No debería pasar nunca: si no hay jugadas legales, B3 ya habría
      // detectado jaque mate/ahogado antes de llegar acá.
      throw new Error('No legal moves available but game is not over');
    }
    return uci;
  }

  // `pendingEntries` son jugadas de este mismo turno que todavía no están
  // persistidas (Bloque C corre después): la jugada del humano siempre, y la
  // de la IA también cuando ya se decidió (B7).
  private async buildMoveHistory(
    gameId: string,
    pendingEntries: MoveHistoryEntry[],
  ): Promise<MoveHistoryEntry[]> {
    const existing = await this.movesRepository.findByGameId(gameId);
    const entries: MoveHistoryEntry[] = existing
      .filter((m) => !m.undone)
      .map((m) => ({ ply: m.ply, san: m.san }));
    entries.push(...pendingEntries);
    return entries.slice(-MOVE_HISTORY_WINDOW);
  }

  private async buildSignals(params: {
    game: Game;
    humanPly: number;
    evalDelta: number | null;
    msThinking: number;
    hesitations: number;
    lastMoveWasUndo: boolean;
    humanFenBefore: string;
    humanUci: string;
    humanSan: string;
  }): Promise<PlayerSignalsInput> {
    const [defensiveStreak, repeatedOpening] = await Promise.all([
      this.computeDefensiveStreak(
        params.game,
        params.humanFenBefore,
        params.humanUci,
      ),
      this.computeRepeatedOpening(
        params.game,
        params.humanPly,
        params.humanSan,
      ),
    ]);

    return {
      msThinking: params.msThinking,
      hesitations: params.hesitations,
      lastMoveWasBlunder: isBlunder(params.evalDelta),
      evalDelta: params.evalDelta,
      repeatedOpening,
      defensiveStreak,
      lastMoveWasUndo: params.lastMoveWasUndo,
    };
  }

  // Heurística propia (no hay algoritmo definido en los docs, ver también
  // candidate-classifier.ts): cuenta jugadas humanas consecutivas —desde la
  // actual hacia atrás, acotado— etiquetadas "defensive".
  private async computeDefensiveStreak(
    game: Game,
    latestHumanFenBefore: string,
    latestHumanUci: string,
  ): Promise<number> {
    if (
      !classifyCandidate(latestHumanFenBefore, latestHumanUci).includes(
        'defensive',
      )
    ) {
      return 0;
    }

    const allMoves = await this.movesRepository.findByGameId(game.id);
    const nonUndone = allMoves.filter((m) => !m.undone);
    const byPly = new Map(nonUndone.map((m) => [m.ply, m]));
    const humanMoves = nonUndone
      .filter((m) => m.side === MoveSide.HUMAN)
      .sort((a, b) => b.ply - a.ply);

    let streak = 1;
    for (const move of humanMoves) {
      if (streak >= DEFENSIVE_STREAK_LOOKBACK) break;
      const beforeFen =
        move.ply === 1 ? game.initialFen : byPly.get(move.ply - 1)?.fenAfter;
      if (!beforeFen) break;
      if (classifyCandidate(beforeFen, move.uci).includes('defensive')) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }

  // "Misma apertura de siempre": compara la primera jugada humana de esta
  // partida contra la frecuencia registrada en PlayerProfile.openings.
  private async computeRepeatedOpening(
    game: Game,
    humanPly: number,
    currentHumanSan: string,
  ): Promise<boolean> {
    const humanFirstPly = game.playerColor === PlayerColor.WHITE ? 1 : 2;
    let openingSan: string;

    if (humanPly === humanFirstPly) {
      openingSan = currentHumanSan;
    } else {
      const moves = await this.movesRepository.findByGameId(game.id);
      const openingMove = moves.find(
        (m) => m.ply === humanFirstPly && !m.undone,
      );
      if (!openingMove) return false;
      openingSan = openingMove.san;
    }

    const profile = await this.playersService
      .getProfile(game.playerId)
      .catch(() => null);
    if (!profile) return false;

    return (profile.openings[openingSan] ?? 0) >= REPEATED_OPENING_THRESHOLD;
  }

  private async buildEndingComment(params: {
    game: Game;
    systemPrompt: string;
    fenBeforeOutcome: string;
    ply: number;
    outcome: GameOutcome;
    hadPrediction: boolean;
    signalsBase: PlayerSignalsInput;
    /** Jugada(s) de este turno, todavía no persistidas (ver buildMoveHistory). */
    pendingMoveEntries: MoveHistoryEntry[];
  }): Promise<TurnComment | null> {
    const {
      game,
      systemPrompt,
      fenBeforeOutcome,
      ply,
      outcome,
      hadPrediction,
      signalsBase,
      pendingMoveEntries,
    } = params;

    const [moveHistory, memories] = await Promise.all([
      this.buildMoveHistory(game.id, pendingMoveEntries),
      this.memoriesService.getRelevantMemories(
        game.playerId,
        RELEVANT_MEMORIES_LIMIT,
      ),
    ]);

    const endingPrompt = this.promptBuilderService.buildEndingPrompt({
      gameContext: {
        playerColor: toPromptPlayerColor(game.playerColor),
        difficulty: toPromptDifficulty(game.difficulty),
        moveHistory,
        currentPhase: detectGamePhase(fenBeforeOutcome, ply),
        materialBalance: formatMaterialBalance(fenBeforeOutcome),
        inCheck: false,
      },
      outcome,
      signals: signalsBase,
      memories: memories.map((m) => m.text),
    });

    const result = await this.llmService.getResponse({
      system: systemPrompt,
      user: endingPrompt,
      hadActivePrediction: hadPrediction,
    });

    if (!result.comment) return null;
    return { text: result.comment, type: result.commentType ?? 'ENDING' };
  }

  private applyOutcomeToGame(
    game: Game,
    outcome: GameOutcome | null,
    fenAfter: string,
    ply: number,
  ): void {
    game.currentFen = fenAfter;
    game.ply = ply;
    if (!outcome) return;

    game.endedAt = new Date();
    if (outcome.status === 'CHECKMATE') {
      game.status = GameStatus.CHECKMATE;
      game.result =
        outcome.winner === 'HUMAN' ? GameResult.WIN : GameResult.LOSS;
    } else {
      game.status = GameStatus.DRAW;
      game.result = GameResult.DRAW;
    }
  }

  private computeMatchPhase(
    outcome: GameOutcome | null,
    isCheck: boolean,
  ): MatchPhase {
    if (outcome) return outcome.status;
    return isCheck ? 'CHECK' : 'ONGOING';
  }

  // "readIndex... global del jugador" (ModeloDatosEndpoints.md) — cruza el
  // perfil ya persistido con lo acumulado en la partida en curso, porque
  // PlayerProfile solo se sincroniza al cerrar la partida.
  private async computeGlobalReadIndex(game: Game): Promise<number> {
    const profile = await this.playersService
      .getProfile(game.playerId)
      .catch(() => null);
    const totalHits = (profile?.correctPredictions ?? 0) + game.readHits;
    const totalAttempts = (profile?.totalPredictions ?? 0) + game.readAttempts;
    if (totalAttempts === 0) return 0;
    return Math.round((totalHits / totalAttempts) * 100) / 100;
  }

  // Nota de alcance: actualiza los contadores simples de PlayerProfile
  // (partidas, resultado, predicciones, apertura, recordByPersonality,
  // avgMsPerMove). `tendencies` (defensivePct, undoRate, etc.) y
  // `avgMsInCheck` requieren un análisis histórico más profundo que no
  // entra en el alcance de este paso — quedan en su valor actual.
  private async updatePlayerProfileOnGameEnd(
    game: Game,
    manager: EntityManager,
  ): Promise<void> {
    const profile = await this.playersService.getProfile(game.playerId);

    profile.games += 1;
    if (game.result === GameResult.WIN) profile.wins += 1;
    else if (game.result === GameResult.LOSS) profile.losses += 1;
    else if (game.result === GameResult.DRAW) profile.draws += 1;

    profile.totalPredictions += game.readAttempts;
    profile.correctPredictions += game.readHits;

    const moves = await this.movesRepository.findByGameId(game.id);
    const humanFirstPly = game.playerColor === PlayerColor.WHITE ? 1 : 2;
    const openingMove = moves.find((m) => m.ply === humanFirstPly && !m.undone);
    if (openingMove) {
      profile.openings = {
        ...profile.openings,
        [openingMove.san]: (profile.openings[openingMove.san] ?? 0) + 1,
      };
    }

    const record = profile.recordByPersonality[game.personalityId] ?? {
      w: 0,
      l: 0,
      d: 0,
    };
    if (game.result === GameResult.WIN) record.w += 1;
    else if (game.result === GameResult.LOSS) record.l += 1;
    else if (game.result === GameResult.DRAW) record.d += 1;
    profile.recordByPersonality = {
      ...profile.recordByPersonality,
      [game.personalityId]: record,
    };

    const humanMoves = moves.filter(
      (m) => m.side === MoveSide.HUMAN && !m.undone && m.msThinking !== null,
    );
    if (humanMoves.length > 0) {
      const thisGameAvg =
        humanMoves.reduce((sum, m) => sum + (m.msThinking ?? 0), 0) /
        humanMoves.length;
      const previousGames = profile.games - 1;
      profile.avgMsPerMove =
        previousGames > 0
          ? Math.round(
              (profile.avgMsPerMove * previousGames + thisGameAvg) /
                profile.games,
            )
          : Math.round(thisGameAvg);
    }

    await this.playersService.saveProfile(profile, manager);
  }
}
