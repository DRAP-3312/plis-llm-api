import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './schemas/game.entity';
import { Move } from './schemas/move.entity';
import { Prediction } from './schemas/prediction.entity';
import { Taunt } from './schemas/taunt.entity';
import { GamesRepository } from './repositories/games.repository';
import { MovesRepository } from './repositories/moves.repository';
import { PredictionsRepository } from './repositories/predictions.repository';
import { TauntsRepository } from './repositories/taunts.repository';
import { GamesController } from './controllers/games.controller';
import { GamesService } from './services/games.service';
import { PlayersModule } from '../players/players.module';
import { TurnModule } from '../turn/turn.module';

// Ciclo GamesModule <-> TurnModule: GamesService delega el turno a
// TurnService, y TurnService necesita los repositorios de este módulo. Se
// resuelve con forwardRef() en ambos lados (ver también turn.module.ts).
@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Move, Prediction, Taunt]),
    PlayersModule,
    forwardRef(() => TurnModule),
  ],
  controllers: [GamesController],
  providers: [
    GamesRepository,
    MovesRepository,
    PredictionsRepository,
    TauntsRepository,
    GamesService,
  ],
  exports: [
    GamesRepository,
    MovesRepository,
    PredictionsRepository,
    TauntsRepository,
  ],
})
export class GamesModule {}
