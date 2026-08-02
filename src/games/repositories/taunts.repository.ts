import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Taunt } from '../schemas/taunt.entity';

@Injectable()
export class TauntsRepository {
  constructor(
    @InjectRepository(Taunt) private readonly repo: Repository<Taunt>,
  ) {}

  create(data: Partial<Taunt>): Taunt {
    return this.repo.create(data);
  }

  save(taunt: Taunt, manager?: EntityManager): Promise<Taunt> {
    return (manager?.getRepository(Taunt) ?? this.repo).save(taunt);
  }

  // Usado por GamesService (GET /games/:id) para reconstruir el historial de
  // comentarios. Sin orden propio: Taunt no tiene timestamp, quien la use la
  // cruza contra el `moveId`/ply del historial de Moves.
  findByGameId(gameId: string): Promise<Taunt[]> {
    return this.repo.find({ where: { gameId } });
  }
}
