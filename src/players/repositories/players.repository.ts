import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Player } from '../schemas/player.entity';
import { PlayerProfile } from '../schemas/player-profile.entity';

@Injectable()
export class PlayersRepository {
  constructor(
    @InjectRepository(Player) private readonly playerRepo: Repository<Player>,
    @InjectRepository(PlayerProfile)
    private readonly profileRepo: Repository<PlayerProfile>,
  ) {}

  create(name: string): Promise<Player> {
    return this.playerRepo.save(this.playerRepo.create({ name }));
  }

  findById(id: string): Promise<Player | null> {
    return this.playerRepo.findOneBy({ id });
  }

  createEmptyProfile(playerId: string): Promise<PlayerProfile> {
    return this.profileRepo.save(
      this.profileRepo.create({
        playerId,
        openings: {},
        recordByPersonality: {},
      }),
    );
  }

  findProfileByPlayerId(playerId: string): Promise<PlayerProfile | null> {
    return this.profileRepo.findOneBy({ playerId });
  }

  saveProfile(
    profile: PlayerProfile,
    manager?: EntityManager,
  ): Promise<PlayerProfile> {
    return (manager?.getRepository(PlayerProfile) ?? this.profileRepo).save(
      profile,
    );
  }
}
