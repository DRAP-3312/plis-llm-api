import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from './config/config.module';
import { typeOrmModuleOptions } from './config/typeorm.config';
import { PlayersModule } from './players/players.module';
import { GamesModule } from './games/games.module';
import { MemoriesModule } from './memories/memories.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmModuleOptions,
    }),
    PlayersModule,
    GamesModule,
    MemoriesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
