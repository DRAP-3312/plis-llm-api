import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Prediction } from '../schemas/prediction.entity';

@Injectable()
export class PredictionsRepository {
  constructor(
    @InjectRepository(Prediction)
    private readonly repo: Repository<Prediction>,
  ) {}

  create(data: Partial<Prediction>): Prediction {
    return this.repo.create(data);
  }

  save(prediction: Prediction, manager?: EntityManager): Promise<Prediction> {
    return (manager?.getRepository(Prediction) ?? this.repo).save(prediction);
  }

  findActiveByGameIdAndTargetPly(
    gameId: string,
    targetPly: number,
  ): Promise<Prediction | null> {
    return this.repo.findOne({ where: { gameId, targetPly, voided: false } });
  }
}
