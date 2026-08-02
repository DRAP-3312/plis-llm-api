import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './schemas/game.entity';
import { Move } from './schemas/move.entity';
import { Prediction } from './schemas/prediction.entity';
import { Taunt } from './schemas/taunt.entity';
import { GamesRepository } from './repositories/games.repository';
import { MovesRepository } from './repositories/moves.repository';
import { PredictionsRepository } from './repositories/predictions.repository';
import { TauntsRepository } from './repositories/taunts.repository';

// GamesService y GamesController todavía no existen: dependen de
// PersonalitiesService (paso 4) y TurnService (paso 6). Por ahora el módulo
// solo expone la capa de datos, ver ProjectStructure.md.
@Module({
  imports: [TypeOrmModule.forFeature([Game, Move, Prediction, Taunt])],
  providers: [
    GamesRepository,
    MovesRepository,
    PredictionsRepository,
    TauntsRepository,
  ],
  exports: [
    GamesRepository,
    MovesRepository,
    PredictionsRepository,
    TauntsRepository,
  ],
})
export class GamesModule {}
