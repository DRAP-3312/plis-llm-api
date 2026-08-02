import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Move } from '../schemas/move.entity';

@Injectable()
export class MovesRepository {
  constructor(
    @InjectRepository(Move) private readonly repo: Repository<Move>,
  ) {}

  create(data: Partial<Move>): Move {
    return this.repo.create(data);
  }

  save(move: Move, manager?: EntityManager): Promise<Move> {
    return (manager?.getRepository(Move) ?? this.repo).save(move);
  }

  findLastByGameId(gameId: string): Promise<Move | null> {
    return this.repo.findOne({ where: { gameId }, order: { ply: 'DESC' } });
  }

  findByGameId(gameId: string): Promise<Move[]> {
    return this.repo.find({ where: { gameId }, order: { ply: 'ASC' } });
  }
}
