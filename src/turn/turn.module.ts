import { Module } from '@nestjs/common';
import { StockfishModule } from '../stockfish/stockfish.module';
import { LlmModule } from '../llm/llm.module';
import { PersonalitiesModule } from '../personalities/personalities.module';
import { MemoriesModule } from '../memories/memories.module';
import { PlayersModule } from '../players/players.module';
import { GamesModule } from '../games/games.module';
import { PromptBuilderService } from './services/prompt-builder.service';
import { TurnService } from './services/turn.service';

// Sin controller propio: GamesController (paso final) lo invoca a través de
// GamesService (ver ProjectStructure.md).
@Module({
  imports: [
    StockfishModule,
    LlmModule,
    PersonalitiesModule,
    MemoriesModule,
    PlayersModule,
    GamesModule,
  ],
  providers: [PromptBuilderService, TurnService],
  exports: [PromptBuilderService, TurnService],
})
export class TurnModule {}
