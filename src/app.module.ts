import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from './config/config.module';
import { typeOrmModuleOptions } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { GamesModule } from './games/games.module';
import { MemoriesModule } from './memories/memories.module';
import { StockfishModule } from './stockfish/stockfish.module';
import { LlmModule } from './llm/llm.module';
import { TurnModule } from './turn/turn.module';
import { PersonalitiesModule } from './personalities/personalities.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmModuleOptions,
    }),
    AuthModule,
    PlayersModule,
    GamesModule,
    MemoriesModule,
    StockfishModule,
    LlmModule,
    TurnModule,
    PersonalitiesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
