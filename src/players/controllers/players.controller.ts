import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlayersService } from '../services/players.service';
import { CreatePlayerDto } from '../dto/create-player.dto';
import { Player } from '../schemas/player.entity';
import { PlayerProfile } from '../schemas/player-profile.entity';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  create(@Body() dto: CreatePlayerDto): Promise<Player> {
    return this.playersService.createPlayer(dto.name);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string): Promise<PlayerProfile> {
    return this.playersService.getProfile(id);
  }
}
