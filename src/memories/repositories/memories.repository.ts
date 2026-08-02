import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Memory } from '../schemas/memory.entity';

@Injectable()
export class MemoriesRepository {
  constructor(
    @InjectRepository(Memory) private readonly repo: Repository<Memory>,
  ) {}

  create(data: Partial<Memory>): Promise<Memory> {
    return this.repo.save(this.repo.create(data));
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
