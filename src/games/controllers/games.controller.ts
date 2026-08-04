import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from '../services/games.service';
import { CreateGameDto } from '../dto/create-game.dto';
import { PlayMoveDto } from '../dto/play-move.dto';
import { Game } from '../schemas/game.entity';
import { GameStateResponse, UndoResponse } from '../games.types';
import { TurnResult } from '../../turn/turn.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentPlayer } from '../../auth/decorators/current-player.decorator';
import type { AuthenticatedPlayer } from '../../auth/auth.types';
import { ClientIp } from '../../common/decorators/client-ip.decorator';

@UseGuards(JwtAuthGuard)
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  create(
    @Body() dto: CreateGameDto,
    @CurrentPlayer() player: AuthenticatedPlayer,
    @ClientIp() ip: string,
  ): Promise<Game> {
    return this.gamesService.createGame(player.playerId, dto, ip);
  }

  @Get(':id')
  getGame(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<GameStateResponse> {
    return this.gamesService.getGame(id, player.playerId);
  }

  @Post(':id/moves')
  playMove(
    @Param('id') id: string,
    @Body() dto: PlayMoveDto,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<TurnResult> {
    return this.gamesService.playMove(id, player.playerId, dto);
  }

  @Post(':id/hesitation')
  @HttpCode(204)
  async hesitation(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<void> {
    await this.gamesService.hesitation(id, player.playerId);
  }

  @Post(':id/undo')
  undo(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<UndoResponse> {
    return this.gamesService.undo(id, player.playerId);
  }

  @Post(':id/resign')
  resign(
    @Param('id') id: string,
    @CurrentPlayer() player: AuthenticatedPlayer,
  ): Promise<Game> {
    return this.gamesService.resign(id, player.playerId);
  }
}
