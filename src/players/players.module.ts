import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './schemas/player.entity';
import { PlayerProfile } from './schemas/player-profile.entity';
import { PlayersRepository } from './repositories/players.repository';
import { PlayersService } from './services/players.service';
import { PlayersController } from './controllers/players.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Player, PlayerProfile])],
  controllers: [PlayersController],
  providers: [PlayersRepository, PlayersService],
  exports: [PlayersService, PlayersRepository],
})
export class PlayersModule {}
