import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Game } from '../schemas/game.entity';

@Injectable()
export class GamesRepository {
  constructor(
    @InjectRepository(Game) private readonly repo: Repository<Game>,
  ) {}

  create(data: Partial<Game>): Game {
    return this.repo.create(data);
  }

  // `manager` la pasa TurnService cuando esta escritura forma parte de la
  // transacción de Bloque C (TurnStateMachine.md); sin él usa la conexión
  // por defecto, para el resto de los casos (ej. crear una partida nueva).
  save(game: Game, manager?: EntityManager): Promise<Game> {
    return (manager?.getRepository(Game) ?? this.repo).save(game);
  }

  findById(id: string): Promise<Game | null> {
    return this.repo.findOneBy({ id });
  }
}
