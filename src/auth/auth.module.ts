import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCredentials } from './schemas/auth-credentials.entity';
import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PlayersModule } from '../players/players.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthCredentials]),
    PlayersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRES_IN_SECONDS'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
