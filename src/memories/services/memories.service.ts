import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MemoriesRepository } from '../repositories/memories.repository';
import { Memory, MemoryType } from '../schemas/memory.entity';

export interface CreateMemoryInput {
  playerId: string;
  gameId: string;
  type: MemoryType;
  text: string;
  weight: number;
}

@Injectable()
export class MemoriesService {
  constructor(private readonly memoriesRepository: MemoriesRepository) {}

  createMemory(
    input: CreateMemoryInput,
    manager?: EntityManager,
  ): Promise<Memory> {
    return this.memoriesRepository.create(input, manager);
  }

  // Usado por TurnService al armar la Capa 4 del prompt. `currentGamesCount`
  // es PlayerProfile.games, necesario para el filtro de "no repetir en
  // partidas consecutivas" (ver memories.repository.ts).
  getRelevantMemories(
    playerId: string,
    currentGamesCount: number,
    limit = 3,
  ): Promise<Memory[]> {
    return this.memoriesRepository.findRelevantForPlayer(
      playerId,
      currentGamesCount,
      limit,
    );
  }

  markUsed(memoryId: string, currentGamesCount: number): Promise<void> {
    return this.memoriesRepository.markUsed(memoryId, currentGamesCount);
  }

  // Se marcan como usadas todas las memorias que entraron al prompt, no solo
  // la que el LLM termine mencionando en el texto — el schema del LLM
  // (PromptStructure.md) no reporta cuál usó. Decisión aceptada: en el peor
  // caso, una memoria relevante descansa una partida extra.
  async markManyUsed(
    memoryIds: string[],
    currentGamesCount: number,
  ): Promise<void> {
    await Promise.all(
      memoryIds.map((id) => this.markUsed(id, currentGamesCount)),
    );
  }
}
