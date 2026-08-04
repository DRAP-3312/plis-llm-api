import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponse } from '../auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @ClientIp() ip: string,
  ): Promise<AuthResponse> {
    return this.authService.register(dto.username, dto.password, ip);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto.username, dto.password);
  }
}
