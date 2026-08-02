import { Injectable } from '@nestjs/common';
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

  createMemory(input: CreateMemoryInput): Promise<Memory> {
    return this.memoriesRepository.create(input);
  }

  // Usado por PromptBuilderService (paso 3) para armar la Capa 4 del prompt.
  getRelevantMemories(playerId: string, limit = 3): Promise<Memory[]> {
    return this.memoriesRepository.findRelevantForPlayer(playerId, limit);
  }

  markUsed(memoryId: string): Promise<void> {
    return this.memoriesRepository.markUsed(memoryId);
  }
}
