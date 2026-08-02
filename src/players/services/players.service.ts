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

  // "readIndex... global del jugador" (ModeloDatosEndpoints.md): cruza el
  // perfil ya persistido con lo acumulado en la partida en curso, porque
  // PlayerProfile solo se sincroniza al cerrar la partida. Compartido por
  // TurnService (response del turno) y GamesService (GET /games/:id).
  async getReadIndex(
    playerId: string,
    gameHits: number,
    gameAttempts: number,
  ): Promise<number> {
    const profile = await this.getProfile(playerId).catch(() => null);
    const totalHits = (profile?.correctPredictions ?? 0) + gameHits;
    const totalAttempts = (profile?.totalPredictions ?? 0) + gameAttempts;
    if (totalAttempts === 0) return 0;
    return Math.round((totalHits / totalAttempts) * 100) / 100;
  }
}
