import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Game, GameStatus } from '../schemas/game.entity';

@Injectable()
export class GamesRepository {
  constructor(
    @InjectRepository(Game) private readonly repo: Repository<Game>,
  ) {}

  create(data: Partial<Game>): Game {
    return this.repo.create(data);
  }

  save(game: Game, manager?: EntityManager): Promise<Game> {
    return (manager?.getRepository(Game) ?? this.repo).save(game);
  }

  findById(id: string): Promise<Game | null> {
    return this.repo.findOneBy({ id });
  }

  countCompletedByPlayerId(playerId: string): Promise<number> {
    return this.repo.countBy({ playerId, status: Not(GameStatus.ONGOING) });
  }

  countCompletedByIpHashSince(ipHash: string, since: Date): Promise<number> {
    return this.repo.count({
      where: {
        creatorIpHash: ipHash,
        status: Not(GameStatus.ONGOING),
        createdAt: MoreThanOrEqual(since),
      },
    });
  }
}
