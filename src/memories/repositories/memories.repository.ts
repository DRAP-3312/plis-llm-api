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

  findRelevantForPlayer(playerId: string, limit: number): Promise<Memory[]> {
    return this.repo.find({
      where: { playerId },
      order: { weight: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.increment({ id }, 'useCount', 1);
    await this.repo.update(id, { lastUsedAt: new Date() });
  }
}
