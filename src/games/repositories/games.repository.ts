import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../schemas/game.entity';

@Injectable()
export class GamesRepository {
  constructor(
    @InjectRepository(Game) private readonly repo: Repository<Game>,
  ) {}

  create(data: Partial<Game>): Game {
    return this.repo.create(data);
  }

  save(game: Game): Promise<Game> {
    return this.repo.save(game);
  }

  findById(id: string): Promise<Game | null> {
    return this.repo.findOneBy({ id });
  }
}
