import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;
}
