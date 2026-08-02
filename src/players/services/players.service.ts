import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PlayersRepository } from '../repositories/players.repository';
import { Player } from '../schemas/player.entity';
import { PlayerProfile } from '../schemas/player-profile.entity';

@Injectable()
export class PlayersService {
  constructor(private readonly playersRepository: PlayersRepository) {}

  async createPlayer(name: string): Promise<Player> {
    const player = await this.playersRepository.create(name);
    await this.playersRepository.createEmptyProfile(player.id);
    return player;
  }

  async getProfile(playerId: string): Promise<PlayerProfile> {
    const profile =
      await this.playersRepository.findProfileByPlayerId(playerId);
    if (!profile) {
      throw new NotFoundException(`Profile for player ${playerId} not found`);
    }
    return profile;
  }

  // Usado por TurnService (paso 6) al cerrar una partida, dentro de la
  // transacción de Bloque C.
  saveProfile(
    profile: PlayerProfile,
    manager?: EntityManager,
  ): Promise<PlayerProfile> {
    return this.playersRepository.saveProfile(profile, manager);
  }
}
