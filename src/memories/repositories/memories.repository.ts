import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Memory } from '../schemas/memory.entity';

@Injectable()
export class MemoriesRepository {
  constructor(
    @InjectRepository(Memory) private readonly repo: Repository<Memory>,
  ) {}

  create(data: Partial<Memory>, manager?: EntityManager): Promise<Memory> {
    const repo = manager?.getRepository(Memory) ?? this.repo;
    return repo.save(repo.create(data));
  }

  // PromptStructure.md (Capa 4): "que no se hayan usado en las últimas 2
  // partidas". `currentGamesCount` es PlayerProfile.games; una memoria es
  // elegible si nunca se usó o si ya pasaron al menos 2 partidas desde la
  // última vez (lastUsedAtGameNumber <= currentGamesCount - 2).
  findRelevantForPlayer(
    playerId: string,
    currentGamesCount: number,
    limit: number,
  ): Promise<Memory[]> {
    const threshold = currentGamesCount - 2;
    return this.repo
      .createQueryBuilder('memory')
      .where('memory.playerId = :playerId', { playerId })
      .andWhere(
        '(memory.lastUsedAtGameNumber IS NULL OR memory.lastUsedAtGameNumber <= :threshold)',
        { threshold },
      )
      .orderBy('memory.weight', 'DESC')
      .addOrderBy('memory.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async markUsed(id: string, currentGamesCount: number): Promise<void> {
    await this.repo.increment({ id }, 'useCount', 1);
    await this.repo.update(id, {
      lastUsedAt: new Date(),
      lastUsedAtGameNumber: currentGamesCount,
    });
  }
}
