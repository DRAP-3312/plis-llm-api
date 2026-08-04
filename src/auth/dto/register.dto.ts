import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,30}$/, {
    message:
      'username must be 3-30 characters long and contain only letters, numbers, "_", "." or "-"',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
