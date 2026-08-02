import { Module } from '@nestjs/common';
import { PromptBuilderService } from './services/prompt-builder.service';

// TurnService (paso 6, TurnStateMachine.md) se suma a este módulo más
// adelante. Sin controller propio: GamesController lo invoca a través de
// GamesService (ver ProjectStructure.md).
@Module({
  providers: [PromptBuilderService],
  exports: [PromptBuilderService],
})
export class TurnModule {}
