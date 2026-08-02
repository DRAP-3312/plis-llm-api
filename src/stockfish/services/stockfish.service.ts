import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
// Import de solo-tipo: no acopla en tiempo de ejecución con el módulo
// `games`, se borra al compilar. Ver la misma nota en games/schemas/*.entity.ts
// sobre no cruzar entidades/servicios entre módulos.
import type { GameDifficulty } from '../../games/schemas/game.entity';
import { classifyCandidate } from './candidate-classifier';
import { Candidate, CandidatesResult } from '../stockfish.types';

interface RawCandidate {
  uci: string;
  score: number;
}

interface RawEvaluateResponse {
  score: number;
}

interface RawAnalyzeResponse {
  bestScore: number;
  candidates: RawCandidate[];
}

const EVAL_MOVETIME_MS = 50;
const PREDICTION_MOVETIME_MS = 500;
const TIMEOUT_MARGIN_MS = 500;

const DIFFICULTY_SETTINGS: Record<
  GameDifficulty,
  { movetime: number; elo?: number }
> = {
  EASY: { movetime: 100, elo: 800 },
  NORMAL: { movetime: 500, elo: 1500 },
  HARD: { movetime: 1500 },
};

@Injectable()
export class StockfishService {
  private readonly logger = new Logger(StockfishService.name);
  private readonly baseUrl: string;
  private readonly timeoutEvalMs: number;
  private readonly timeoutPredictionMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('STOCKFISH_URL')!;
    this.timeoutEvalMs = this.configService.get<number>(
      'STOCKFISH_TIMEOUT_EVAL_MS',
    )!;
    this.timeoutPredictionMs = this.configService.get<number>(
      'STOCKFISH_TIMEOUT_PREDICTION_MS',
    )!;
  }

  async getEvaluation(fen: string): Promise<number | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<RawEvaluateResponse>(
          `${this.baseUrl}/evaluate`,
          { fen, movetime: EVAL_MOVETIME_MS },
          { timeout: this.timeoutEvalMs },
        ),
      );
      return data.score;
    } catch (err) {
      this.logFailure('getEvaluation', err);
      return null;
    }
  }

  async getCandidates(
    fen: string,
    difficulty: GameDifficulty,
  ): Promise<CandidatesResult | null> {
    const { movetime, elo } = DIFFICULTY_SETTINGS[difficulty];
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<RawAnalyzeResponse>(
          `${this.baseUrl}/analyze`,
          { fen, movetime, elo, multiPV: 3 },
          { timeout: movetime + TIMEOUT_MARGIN_MS },
        ),
      );
      return this.toCandidatesResult(fen, data);
    } catch (err) {
      this.logFailure('getCandidates', err);
      return null;
    }
  }

  async getPrediction(fen: string): Promise<CandidatesResult | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<RawAnalyzeResponse>(
          `${this.baseUrl}/analyze`,
          { fen, movetime: PREDICTION_MOVETIME_MS, multiPV: 3 },
          { timeout: this.timeoutPredictionMs + TIMEOUT_MARGIN_MS },
        ),
      );
      return this.toCandidatesResult(fen, data);
    } catch (err) {
      this.logFailure('getPrediction', err);
      return null;
    }
  }

  private toCandidatesResult(
    fen: string,
    raw: RawAnalyzeResponse,
  ): CandidatesResult {
    const candidates: Candidate[] = raw.candidates.map((candidate) => ({
      uci: candidate.uci,
      score: candidate.score,
      tags: classifyCandidate(fen, candidate.uci),
    }));
    return { bestScore: raw.bestScore, candidates };
  }

  private logFailure(method: string, err: unknown): void {
    const message = err instanceof AxiosError ? err.message : String(err);
    this.logger.warn(`StockfishService.${method} failed: ${message}`);
  }
}
