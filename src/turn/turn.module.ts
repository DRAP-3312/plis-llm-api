import { Module, forwardRef } from '@nestjs/common';
import { StockfishModule } from '../stockfish/stockfish.module';
import { LlmModule } from '../llm/llm.module';
import { PersonalitiesModule } from '../personalities/personalities.module';
import { MemoriesModule } from '../memories/memories.module';
import { PlayersModule } from '../players/players.module';
import { GamesModule } from '../games/games.module';
import { PromptBuilderService } from './services/prompt-builder.service';
import { TurnService } from './services/turn.service';

// Sin controller propio: GamesController lo invoca a través de GamesService
// (ver ProjectStructure.md). GamesModule importa este módulo (forwardRef,
// ver games.module.ts) para que GamesService pueda delegarle el turno.
@Module({
  imports: [
    StockfishModule,
    LlmModule,
    PersonalitiesModule,
    MemoriesModule,
    PlayersModule,
    forwardRef(() => GamesModule),
  ],
  providers: [PromptBuilderService, TurnService],
  exports: [PromptBuilderService, TurnService],
})
export class TurnModule {}
