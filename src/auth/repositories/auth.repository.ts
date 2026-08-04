import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthCredentials } from '../schemas/auth-credentials.entity';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(AuthCredentials)
    private readonly repo: Repository<AuthCredentials>,
  ) {}

  create(data: Partial<AuthCredentials>): Promise<AuthCredentials> {
    return this.repo.save(this.repo.create(data));
  }

  findByUsername(username: string): Promise<AuthCredentials | null> {
    return this.repo.findOneBy({ username });
  }

  countByRegistrationIpHash(registrationIpHash: string): Promise<number> {
    return this.repo.countBy({ registrationIpHash });
  }
}
