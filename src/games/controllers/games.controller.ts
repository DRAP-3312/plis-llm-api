import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GamesService } from '../services/games.service';
import { CreateGameDto } from '../dto/create-game.dto';
import { PlayMoveDto } from '../dto/play-move.dto';
import { Game } from '../schemas/game.entity';
import { GameStateResponse, UndoResponse } from '../games.types';
import { TurnResult } from '../../turn/turn.types';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  create(@Body() dto: CreateGameDto): Promise<Game> {
    return this.gamesService.createGame(dto);
  }

  @Get(':id')
  getGame(@Param('id') id: string): Promise<GameStateResponse> {
    return this.gamesService.getGame(id);
  }

  @Post(':id/moves')
  playMove(
    @Param('id') id: string,
    @Body() dto: PlayMoveDto,
  ): Promise<TurnResult> {
    return this.gamesService.playMove(id, dto);
  }

  @Post(':id/hesitation')
  @HttpCode(204)
  async hesitation(@Param('id') id: string): Promise<void> {
    await this.gamesService.hesitation(id);
  }

  @Post(':id/undo')
  undo(@Param('id') id: string): Promise<UndoResponse> {
    return this.gamesService.undo(id);
  }

  @Post(':id/resign')
  resign(@Param('id') id: string): Promise<Game> {
    return this.gamesService.resign(id);
  }
}
