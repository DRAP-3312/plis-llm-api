import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PlayersService } from '../services/players.service';
import { PlayerProfile } from '../schemas/player-profile.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentPlayer } from '../../auth/decorators/current-player.decorator';
import type { AuthenticatedPlayer } from '../../auth/auth.types';

@UseGuards(JwtAuthGuard)
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get(':id/profile')
  getProfile(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<PlayerProfile> {
    if (id !== player.playerId) {
      throw new ForbiddenException('this profile does not belong to you');
    }
    return this.playersService.getProfile(id);
  }
}
