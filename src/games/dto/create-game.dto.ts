import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import {
  GameDifficulty,
  PlayerColor,
  SpiceLevel,
} from '../schemas/game.entity';

export class CreateGameDto {
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
