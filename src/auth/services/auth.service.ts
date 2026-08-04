import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from '../repositories/auth.repository';
import { PlayersService } from '../../players/services/players.service';
import { hashIp } from '../../common/utils/hash-ip.util';
import { AuthResponse } from '../auth.types';
import { JwtPayload } from '../jwt-payload.interface';

const BCRYPT_SALT_ROUNDS = 12;
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly playersService: PlayersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    username: string,
    password: string,
    ip: string,
  ): Promise<AuthResponse> {
    const existing = await this.authRepository.findByUsername(username);
    if (existing) {
      throw new ConflictException('username is already taken');
    }

    const ipHash = hashIp(ip, this.configService.get<string>('IP_HASH_SALT')!);
    const maxAccountsPerIp = this.configService.get<number>(
      'AUTH_MAX_ACCOUNTS_PER_IP',
    )!;
    const accountsFromIp =
      await this.authRepository.countByRegistrationIpHash(ipHash);
    if (accountsFromIp >= maxAccountsPerIp) {
      throw new ForbiddenException(
        'too many accounts have already been created from this network',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const player = await this.playersService.createPlayer(username);

    try {
      await this.authRepository.create({
        playerId: player.id,
        username,
        passwordHash,
        registrationIpHash: ipHash,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('username is already taken');
      }
      throw err;
    }

    return this.buildAuthResponse(player.id, username);
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const credentials = await this.authRepository.findByUsername(username);
    if (!credentials) {
      throw new UnauthorizedException('invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      credentials.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('invalid credentials');
    }

    return this.buildAuthResponse(credentials.playerId, credentials.username);
  }

  private buildAuthResponse(playerId: string, username: string): AuthResponse {
    const payload: JwtPayload = { sub: playerId, username };
    return {
      accessToken: this.jwtService.sign(payload),
      playerId,
      username,
    };
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
