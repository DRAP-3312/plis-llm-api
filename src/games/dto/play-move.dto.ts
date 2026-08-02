import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

const SQUARE_PATTERN = /^[a-h][1-8]$/;

export class PlayMoveDto {
  @Matches(SQUARE_PATTERN)
  from!: string;

  @Matches(SQUARE_PATTERN)
  to!: string;

  @IsOptional()
  @IsIn(['q', 'r', 'b', 'n'])
  promo?: string;

  @IsInt()
  @Min(1)
  expectedPly!: number;

  @IsInt()
  @Min(0)
  msThinking!: number;

  @IsInt()
  @Min(0)
  hesitations!: number;
}
