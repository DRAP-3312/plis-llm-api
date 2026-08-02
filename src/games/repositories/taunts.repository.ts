import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Taunt } from '../schemas/taunt.entity';

@Injectable()
export class TauntsRepository {
  constructor(
    @InjectRepository(Taunt) private readonly repo: Repository<Taunt>,
  ) {}

  create(data: Partial<Taunt>): Taunt {
    return this.repo.create(data);
  }

  save(taunt: Taunt): Promise<Taunt> {
    return this.repo.save(taunt);
  }
}
