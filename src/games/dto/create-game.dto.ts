import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import {
  GameDifficulty,
  PlayerColor,
  SpiceLevel,
} from '../schemas/game.entity';

export class CreateGameDto {
  @IsUUID()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  personalityId!: string;

  @IsEnum(GameDifficulty)
  difficulty!: GameDifficulty;

  @IsEnum(PlayerColor)
  playerColor!: PlayerColor;

  @IsEnum(SpiceLevel)
  spiceLevel!: SpiceLevel;
}
